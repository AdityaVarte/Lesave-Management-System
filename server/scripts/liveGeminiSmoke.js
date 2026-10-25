require('dotenv').config({ path: require('path').resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');
const Employee = require('../models/Employee');
const seedData = require('../seedData');
const { handleChat } = require('../services/chatService');

const runLiveGeminiSmoke = async () => {
  console.log('--- Starting Live Gemini Smoke Test ---');

  // Verify GEMINI_API_KEY is present without printing it
  if (!process.env.GEMINI_API_KEY) {
    console.error('❌ Error: GEMINI_API_KEY is not set in environment or .env');
    process.exit(1);
  }
  console.log('✅ GEMINI_API_KEY is present (secret masked)');
  console.log('ℹ Model:', process.env.GEMINI_MODEL || 'gemini-2.5-flash');

  // Connect to DB
  let mongod = null;
  try {
    await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 3000 });
    console.log('✅ Connected to MongoDB');
  } catch (err) {
    console.log('ℹ Atlas connection failed, starting MongoMemoryServer...');
    mongod = await MongoMemoryServer.create();
    await mongoose.connect(mongod.getUri());
    console.log('✅ Connected to local MongoMemoryServer');
  }

  // Ensure DB has seeded data
  await seedData();

  // Find seeded employee user
  const user = await Employee.findOne({ email: 'rohan@company.com' }).lean();
  if (!user) {
    console.error('❌ Error: Seeded employee rohan@company.com not found');
    process.exit(1);
  }
  console.log(`✅ Loaded test user: ${user.name} (${user.email}, ${user.role}, ${user.department})`);

  const futureDate = '2026-11-15';
  const testPrompts = [
    'which department had the most approved leaves this year',
    'how many leaves do I have left',
    `apply casual leave on ${futureDate} for a family function`,
    'compile all my leaves into a portable document',
  ];

  const results = [];

  for (let i = 0; i < testPrompts.length; i++) {
    const prompt = testPrompts[i];
    console.log(`\n========================================`);
    console.log(`[Prompt ${i + 1}/4]: "${prompt}"`);
    console.log(`========================================`);

    try {
      const response = await handleChat({
        user,
        message: prompt,
        history: [],
      });

      const hasPendingAction = Boolean(response.pendingAction);
      const hasFile = Boolean(response.file);

      console.log(`• Reply Text:\n${response.reply}`);
      console.log(`• Tools Called: [${(response.toolsCalled || []).join(', ')}]`);
      console.log(`• Pending Action: ${hasPendingAction ? `YES (${response.pendingAction.tool})` : 'NO'}`);
      console.log(`• File Returned: ${hasFile ? `YES (${response.file.name})` : 'NO'}`);
      console.log(`• Source: ${response.source || 'gemini'}`);

      results.push({
        prompt,
        success: true,
        toolsCalled: response.toolsCalled || [],
        hasPendingAction,
        hasFile,
      });
    } catch (err) {
      console.error(`❌ Prompt ${i + 1} failed:`, err.message);
      results.push({
        prompt,
        success: false,
        error: err.message,
      });
    }
  }

  console.log(`\n========================================`);
  console.log(`Summary of Live Gemini Smoke:`);
  console.log(`Total: ${testPrompts.length}, Succeeded: ${results.filter((r) => r.success).length}, Failed: ${results.filter((r) => !r.success).length}`);
  console.log(`========================================\n`);

  await mongoose.disconnect();
  if (mongod) {
    await mongod.stop();
  }
};

runLiveGeminiSmoke().catch((err) => {
  console.error('Fatal error during smoke test:', err);
  process.exit(1);
});
