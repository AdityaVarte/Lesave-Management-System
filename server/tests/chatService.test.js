require('dotenv').config();
const test = require('node:test');
const assert = require('node:assert');

process.env.GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'test-api-key';
process.env.GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';

const { buildSystemInstruction, formatGeminiContents } = require('../services/chatService');

test('buildSystemInstruction - incorporates user context and role', () => {
  const dummyUser = {
    name: 'Rohan Sharma',
    email: 'rohan@company.com',
    role: 'employee',
    department: 'Engineering',
  };

  const instruction = buildSystemInstruction(dummyUser);
  assert.ok(instruction.includes('Rohan Sharma'));
  assert.ok(instruction.includes('Engineering'));
  assert.ok(instruction.includes('Employee'));
  assert.ok(instruction.includes('YYYY-MM-DD'));
});

test('buildSystemInstruction - reflects administrator role', () => {
  const dummyAdmin = {
    name: 'Admin User',
    email: 'admin@company.com',
    role: 'admin',
    department: 'HR',
  };

  const instruction = buildSystemInstruction(dummyAdmin);
  assert.ok(instruction.includes('Administrator'));
  assert.ok(instruction.includes('Admin User'));
});

test('formatGeminiContents - formats user and model turns correctly', () => {
  const history = [
    { role: 'user', text: 'Hello' },
    { role: 'assistant', text: 'Hi! How can I help you today?' },
  ];
  const currentMessage = 'What is my leave status?';

  const contents = formatGeminiContents(history, currentMessage);
  assert.strictEqual(contents.length, 3);
  assert.strictEqual(contents[0].role, 'user');
  assert.strictEqual(contents[0].parts[0].text, 'Hello');
  assert.strictEqual(contents[1].role, 'model');
  assert.strictEqual(contents[1].parts[0].text, 'Hi! How can I help you today?');
  assert.strictEqual(contents[2].role, 'user');
  assert.strictEqual(contents[2].parts[0].text, 'What is my leave status?');
});

test('formatGeminiContents - caps history to last 15 items', () => {
  const longHistory = Array.from({ length: 25 }, (_, i) => ({
    role: i % 2 === 0 ? 'user' : 'assistant',
    text: `Message ${i}`,
  }));

  const contents = formatGeminiContents(longHistory, 'Latest');
  // 15 history items + 1 current = 16
  assert.strictEqual(contents.length, 16);
  assert.strictEqual(contents[contents.length - 1].parts[0].text, 'Latest');
});

test('formatGeminiContents - excludes error bubbles from history', () => {
  const history = [
    { role: 'user', text: 'Hello' },
    { role: 'assistant', text: 'The assistant is busy right now.', isError: true },
    { role: 'assistant', text: 'Welcome! How can I help?' },
    { role: 'assistant', text: 'Another error message', isError: true },
  ];
  const contents = formatGeminiContents(history, 'My balance?');
  // Should only include the 2 non-error items + 1 current = 3
  assert.strictEqual(contents.length, 3);
  assert.strictEqual(contents[0].parts[0].text, 'Hello');
  assert.strictEqual(contents[1].parts[0].text, 'Welcome! How can I help?');
  assert.strictEqual(contents[2].parts[0].text, 'My balance?');
});

const {
  executeGeminiCall,
  mapToClientError,
  parseError,
  _setMockGenerateContent,
  _clearMockGenerateContent,
} = require('../services/chatService');

test('mapToClientError - maps status codes to exact required friendly messages', () => {
  // 503 -> 503
  const err503 = new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
  err503.status = 503;
  const mapped503 = mapToClientError(err503);
  assert.strictEqual(mapped503.status, 503);
  assert.strictEqual(mapped503.message, 'The assistant is busy right now. Please try again in a moment.');

  // 429 -> 429
  const err429 = new Error('RESOURCE_EXHAUSTED: quota exceeded');
  err429.status = 429;
  const mapped429 = mapToClientError(err429);
  assert.strictEqual(mapped429.status, 429);
  assert.strictEqual(mapped429.message, 'Too many requests or quota reached. Please wait a minute and try again.');

  // 400/401/403 or invalid model -> 502
  const err401 = new Error('UNAUTHENTICATED');
  err401.status = 401;
  const mapped401 = mapToClientError(err401);
  assert.strictEqual(mapped401.status, 502);
  assert.strictEqual(mapped401.message, 'Assistant configuration error. Contact the administrator.');

  const errModelNotFound = new Error('models/gemini-2.5-flash is not found');
  errModelNotFound.status = 404;
  const mappedModel = mapToClientError(errModelNotFound);
  assert.strictEqual(mappedModel.status, 502);
  assert.strictEqual(mappedModel.message, 'Assistant configuration error. Contact the administrator.');

  // timeout -> 504
  const errTimeout = new Error('AI request timed out after 25 seconds');
  errTimeout.isTimeout = true;
  const mappedTimeout = mapToClientError(errTimeout);
  assert.strictEqual(mappedTimeout.status, 504);
  assert.strictEqual(mappedTimeout.message, 'The assistant took too long to respond.');
});

test('BUG-02: 503 then success (at most 1 retry)', async () => {
  let callCount = 0;
  const dummyContents = [{ role: 'user', parts: [{ text: 'Hello' }] }];

  _setMockGenerateContent(async () => {
    callCount++;
    if (callCount === 1) {
      const err = new Error('{"error":{"code":503,"message":"This model is currently experiencing high demand.","status":"UNAVAILABLE"}}');
      err.status = 503;
      err.retryDelay = 20; // < 5000ms
      throw err;
    }
    return { text: 'Success on retry attempt 1!' };
  });

  try {
    const res = await executeGeminiCall(dummyContents, 'instruction');
    assert.strictEqual(callCount, 2); // 1 initial + 1 retry
    assert.strictEqual(res.reply, 'Success on retry attempt 1!');
  } finally {
    _clearMockGenerateContent();
  }
});

test('BUG-02: 503 then fallback success', async () => {
  const calls = [];
  const dummyContents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-fallback-test';

  _setMockGenerateContent(async ({ model }) => {
    calls.push(model);
    if (model === 'gemini-fallback-test') {
      return { text: 'Hello from fallback model!' };
    }
    // Main model fails with 503
    const err = new Error('503 Service Unavailable');
    err.status = 503;
    err.retryDelay = 15;
    throw err;
  });

  try {
    const res = await executeGeminiCall(dummyContents, 'instruction');
    assert.strictEqual(res.reply, 'Hello from fallback model!');
    const mainModel = process.env.GEMINI_MODEL;
    const mainCalls = calls.filter((m) => m === mainModel);
    const fallbackCalls = calls.filter((m) => m === 'gemini-fallback-test');
    assert.strictEqual(mainCalls.length, 2, 'Main model should be called exactly twice: 1 initial + 1 retry');
    assert.strictEqual(fallbackCalls.length, 1, 'Fallback model should be called once');
  } finally {
    process.env.GEMINI_FALLBACK_MODEL = originalFallback;
    _clearMockGenerateContent();
  }
});

test('BUG-02: 503 on both ends with friendly message in under the deadline', async () => {
  let callCount = 0;
  const dummyContents = [{ role: 'user', parts: [{ text: 'Hello' }] }];
  const originalFallback = process.env.GEMINI_FALLBACK_MODEL;
  process.env.GEMINI_FALLBACK_MODEL = 'gemini-fallback-test';
  const start = Date.now();

  _setMockGenerateContent(async () => {
    callCount++;
    const err = new Error('503 Service Unavailable');
    err.status = 503;
    err.retryDelay = 15;
    throw err;
  });

  try {
    await assert.rejects(
      async () => {
        await executeGeminiCall(dummyContents, 'instruction');
      },
      (err) => {
        assert.strictEqual(err.status, 503);
        assert.strictEqual(err.message, 'The assistant is busy right now. Please try again in a moment.');
        assert.ok(!err.message.includes('{'));
        return true;
      }
    );
    // 2 on main model (1 initial + 1 retry) + 1 on fallback model = 3 total
    assert.strictEqual(callCount, 3);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 2000, `Execution should finish well under deadline, took ${elapsed}ms`);
  } finally {
    process.env.GEMINI_FALLBACK_MODEL = originalFallback;
    _clearMockGenerateContent();
  }
});

test('BUG-02: 429 path (at most 1 retry and returns 429 friendly message)', async () => {
  let callCount = 0;
  const dummyContents = [{ role: 'user', parts: [{ text: 'Hello' }] }];

  _setMockGenerateContent(async () => {
    callCount++;
    const err = new Error('RESOURCE_EXHAUSTED: quota exceeded');
    err.status = 429;
    err.retryDelay = 15;
    throw err;
  });

  try {
    await assert.rejects(
      async () => {
        await executeGeminiCall(dummyContents, 'instruction');
      },
      (err) => {
        assert.strictEqual(err.status, 429);
        assert.strictEqual(err.message, 'Too many requests or quota reached. Please wait a minute and try again.');
        return true;
      }
    );
    // 1 initial + 1 retry = 2
    assert.strictEqual(callCount, 2);
  } finally {
    _clearMockGenerateContent();
  }
});

test('BUG-02: 400 and 403 are NOT retried (fail immediately with 502)', async () => {
  // Test 400
  let callCount400 = 0;
  _setMockGenerateContent(async () => {
    callCount400++;
    const err = new Error('INVALID_ARGUMENT: Bad parameter');
    err.status = 400;
    throw err;
  });
  await assert.rejects(
    async () => {
      await executeGeminiCall([{ role: 'user', parts: [{ text: 'Hello' }] }], 'instruction');
    },
    (err) => {
      assert.strictEqual(err.status, 502);
      assert.strictEqual(err.message, 'Assistant configuration error. Contact the administrator.');
      return true;
    }
  );
  assert.strictEqual(callCount400, 1, '400 must NOT be retried');

  // Test 403
  let callCount403 = 0;
  _setMockGenerateContent(async () => {
    callCount403++;
    const err = new Error('PERMISSION_DENIED: Access forbidden');
    err.status = 403;
    throw err;
  });
  await assert.rejects(
    async () => {
      await executeGeminiCall([{ role: 'user', parts: [{ text: 'Hello' }] }], 'instruction');
    },
    (err) => {
      assert.strictEqual(err.status, 502);
      assert.strictEqual(err.message, 'Assistant configuration error. Contact the administrator.');
      return true;
    }
  );
  assert.strictEqual(callCount403, 1, '403 must NOT be retried');
  _clearMockGenerateContent();
});

test('BUG-02: mid-tool-loop 503 after first call succeeded returns friendly data step message', async () => {
  const originalGetBalance = dataService.getBalance;
  dataService.getBalance = async () => ({
    total: 20,
    approvedDays: 2,
    pendingDays: 1,
    confirmedRemaining: 18,
    availableBalance: 17,
  });

  let turnIndex = 0;
  _setMockGenerateContent(async () => {
    turnIndex++;
    if (turnIndex === 1) {
      // First model call succeeds and calls tool
      return {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [{ functionCall: { name: 'get_my_leave_balance', args: {} } }],
            },
            finishReason: 'STOP',
          },
        ],
      };
    }
    // Second model call (interpreting tool output) 503s on all retries
    const err = new Error('503 Service Unavailable');
    err.status = 503;
    err.retryDelay = 10;
    throw err;
  });

  try {
    const dummyUser = { _id: 'emp-123', name: 'Rohan Sharma', role: 'employee', department: 'Engineering' };
    const res = await executeGeminiCall({
      user: dummyUser,
      contents: [{ role: 'user', parts: [{ text: 'How many leaves do I have left?' }] }],
      systemInstruction: 'instruction',
    });

    assert.strictEqual(res.source, 'gemini');
    assert.deepStrictEqual(res.toolsCalled, ['get_my_leave_balance']);
    assert.ok(res.reply.includes('The data step finished, but the answer could not be completed'));
  } finally {
    dataService.getBalance = originalGetBalance;
    _clearMockGenerateContent();
  }
});

const dataService = require('../services/dataService');

test('BUG-01 Contract: Gemini tool loop contents contract and role validation', async () => {
  const originalGetBalance = dataService.getBalance;
  dataService.getBalance = async () => ({
    total: 20,
    approvedDays: 2,
    pendingDays: 1,
    confirmedRemaining: 18,
    availableBalance: 17,
  });

  const capturedContentsSnapshots = [];
  let turnIndex = 0;

  _setMockGenerateContent(async ({ contents }) => {
    // Contract assertion: Mock SDK strictly rejects any role other than 'user' and 'model'
    for (const turn of contents) {
      if (turn.role !== 'user' && turn.role !== 'model') {
        const err = new Error(`INVALID_ARGUMENT: Role '${turn.role}' is not supported. Supported roles: 'user', 'model'.`);
        err.status = 400;
        throw err;
      }
    }

    // Capture deep snapshot of contents at each turn
    capturedContentsSnapshots.push(JSON.parse(JSON.stringify(contents)));
    turnIndex++;

    if (turnIndex === 1) {
      // Return a function call turn matching real @google/genai SDK candidate response
      return {
        candidates: [
          {
            content: {
              role: 'model',
              parts: [
                {
                  functionCall: {
                    name: 'get_my_leave_balance',
                    args: {},
                  },
                },
              ],
            },
            finishReason: 'STOP',
          },
        ],
      };
    }

    // Second turn: Model receives functionResponse and returns final text
    return {
      candidates: [
        {
          content: {
            role: 'model',
            parts: [
              {
                text: 'You currently have 17 available leave days remaining.',
              },
            ],
          },
          finishReason: 'STOP',
        },
      ],
    };
  });

  try {
    const dummyUser = { _id: 'emp-123', name: 'Rohan Sharma', role: 'employee', department: 'Engineering' };
    const initialContents = [{ role: 'user', parts: [{ text: 'How many leaves do I have left?' }] }];

    const result = await executeGeminiCall({
      user: dummyUser,
      contents: initialContents,
      systemInstruction: 'You are LeaveFlow AI',
    });

    assert.strictEqual(result.reply, 'You currently have 17 available leave days remaining.');
    assert.deepStrictEqual(result.toolsCalled, ['get_my_leave_balance']);

    // Assert on captured contents at Turn 2 (when model receives tool output)
    const turn2Contents = capturedContentsSnapshots[1];
    assert.ok(turn2Contents, 'Turn 2 contents must be captured');
    assert.strictEqual(turn2Contents.length, 3, 'Turn 2 contents should have 3 turns: user query, model functionCall, user functionResponse');

    // 1. Assert every role is strictly 'user' or 'model' (never 'tool' or 'function')
    for (const turn of turn2Contents) {
      assert.ok(
        turn.role === 'user' || turn.role === 'model',
        `Every turn role must be 'user' or 'model', but found '${turn.role}'`
      );
      assert.notStrictEqual(turn.role, 'tool', "Role must NEVER be 'tool'");
      assert.notStrictEqual(turn.role, 'function', "Role must NEVER be 'function'");
    }

    // 2. Assert Turn 0: user text
    assert.strictEqual(turn2Contents[0].role, 'user');
    assert.strictEqual(turn2Contents[0].parts[0].text, 'How many leaves do I have left?');

    // 3. Assert Turn 1: model candidate content unmodified
    assert.strictEqual(turn2Contents[1].role, 'model');
    assert.ok(turn2Contents[1].parts[0].functionCall);
    assert.strictEqual(turn2Contents[1].parts[0].functionCall.name, 'get_my_leave_balance');

    // 4. Assert Turn 2: user functionResponse with untrusted data wrapper
    assert.strictEqual(turn2Contents[2].role, 'user');
    assert.ok(turn2Contents[2].parts[0].functionResponse);
    assert.strictEqual(turn2Contents[2].parts[0].functionResponse.name, 'get_my_leave_balance');
    const fnResp = turn2Contents[2].parts[0].functionResponse.response;
    assert.strictEqual(fnResp.dataType, 'LEAVE_MANAGEMENT_DATA');
    assert.strictEqual(fnResp.untrustedTextFields, true);
    assert.strictEqual(fnResp.content.availableBalance, 17);

    // 5. Assert every functionCall is followed by a matching functionResponse
    let foundFunctionCall = false;
    for (let i = 0; i < turn2Contents.length; i++) {
      const part = turn2Contents[i].parts[0];
      if (part.functionCall) {
        foundFunctionCall = true;
        const nextTurn = turn2Contents[i + 1];
        assert.ok(nextTurn, 'functionCall must be followed by a function response turn');
        assert.strictEqual(nextTurn.role, 'user', 'functionResponse turn must have role "user"');
        assert.strictEqual(
          nextTurn.parts[0].functionResponse?.name,
          part.functionCall.name,
          'functionResponse name must match functionCall name'
        );
      }
    }
    assert.ok(foundFunctionCall, 'Must have verified at least one functionCall/functionResponse pair');
  } finally {
    dataService.getMyLeaveBalance = originalGetBalance;
    _clearMockGenerateContent();
  }
});

test('BUG-01 Contract: SDK and invokeSingleTurn REJECT invalid roles like "tool"', async () => {
  const invalidContents = [
    { role: 'user', parts: [{ text: 'Hello' }] },
    { role: 'tool', parts: [{ text: 'invalid tool role' }] },
  ];

  await assert.rejects(
    async () => {
      await executeGeminiCall(invalidContents, 'instruction');
    },
    (err) => {
      // 400 is mapped to 502 configuration error by executeGeminiCall
      assert.strictEqual(err.status, 502);
      assert.strictEqual(err.message, 'Assistant configuration error. Contact the administrator.');
      return true;
    }
  );
});


