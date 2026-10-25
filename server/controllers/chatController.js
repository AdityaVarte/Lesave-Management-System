const fs = require('fs');
const path = require('path');
const { validationResult } = require('express-validator');
const chatService = require('../services/chatService');
const dataService = require('../services/dataService');
const pdfService = require('../services/pdfService');
const { matchIntent, normalizeMessage } = require('../services/intentEngine');
const intentHandlers = require('../services/intentHandlers');
const slotFilling = require('../services/slotFilling');
const pendingActions = require('../services/pendingActions');
const geminiTracker = require('../services/geminiTracker');
const { formatDisplayDate, formatISODate } = require('../utils/dateUtils');

/**
 * POST /api/chatbot
 * Send a chat message with conversation history.
 * 1. Checks active slot-filling state.
 * 2. Runs Rule Engine.
 * 3. Falls back to Gemini.
 */
const postChat = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        message: errors.array().map((e) => e.msg).join(', '),
      });
    }

    const { message, history } = req.body;
    const normalized = normalizeMessage(message);

    // ─── 1. Check Active Slot-Filling State ─────────────────────────────────
    const activeSlotState = slotFilling.getSlotState(req.user._id);

    if (activeSlotState) {
      // 1a. User explicitly cancels the draft itself (e.g. "cancel", "never mind", "stop")
      if (slotFilling.isCancelMessage(message)) {
        slotFilling.clearSlotState(req.user._id);
        console.log(`[Chatbot] source=rules intent=SLOT_CANCELLED userId=${req.user._id}`);
        return res.json({
          reply: activeSlotState.intent === 'PDF_EXPORT'
            ? 'Your PDF report request has been cancelled.'
            : 'Your draft leave request has been cancelled.',
          source: 'rules',
          pendingAction: null,
        });
      }

      // 1b. Continue PDF_EXPORT slot filling (user specifies which data to include in PDF)
      if (activeSlotState.intent === 'PDF_EXPORT') {
        slotFilling.clearSlotState(req.user._id);
        console.log(`[Chatbot] source=rules intent=PDF_SLOT_COMPLETE userId=${req.user._id}`);
        const { parseEntities } = require('../services/entityParser');
        const entities = parseEntities(message);
        const pdfResult = await intentHandlers.handlePdfExport(req.user, entities, message);
        return res.json({
          reply: pdfResult.reply,
          file: pdfResult.file || null,
          source: 'rules',
          pendingAction: null,
        });
      }

      // 1c. For APPLY_LEAVE or REJECT: user switches to a different intent (e.g. "cancel my pending leave", "what is my balance", etc.)
      const altMatch = matchIntent(normalized, req.user);
      if (altMatch && altMatch.intent !== 'APPLY_LEAVE' && altMatch.intent !== 'REJECT') {
        slotFilling.clearSlotState(req.user._id);
        console.log(`[Chatbot] source=rules intent=${altMatch.intent} userId=${req.user._id} (dropped draft)`);
        const altResult = await intentHandlers.executeHandler(
          altMatch.intent,
          req.user,
          altMatch.entities,
          message
        );
        const altReply = typeof altResult === 'object' && altResult !== null ? altResult.reply : altResult;
        const altPending = typeof altResult === 'object' && altResult !== null ? altResult.pendingAction : null;

        return res.json({
          reply: `*(Draft application cancelled)*\n\n${altReply}`,
          source: 'rules',
          pendingAction: altPending || null,
        });
      }

      // 1d. Continue slot-filling step
      if (activeSlotState.intent === 'APPLY_LEAVE') {
        const step = await slotFilling.processApplySlotFilling(req.user, message, activeSlotState);
        if (step.complete) {
          // Generate pendingAction card
          const validated = await dataService.validateLeaveApplication(req.user, {
            leave_type_name: step.slots.leaveType,
            start_date: step.slots.startDate,
            end_date: step.slots.endDate,
            is_half_day: step.slots.isHalfDay,
            reason: step.slots.reason,
          });

          const startDisplay = formatDisplayDate(step.slots.startDate);
          const endDisplay = formatDisplayDate(step.slots.endDate);
          const datesLine =
            step.slots.startDate === step.slots.endDate
              ? `${startDisplay} (${step.slots.startDate})`
              : `${startDisplay} (${step.slots.startDate}) to ${endDisplay} (${step.slots.endDate})`;

          const summary = [
            `• Leave Type: ${step.slots.leaveType} Leave`,
            `• Dates: ${datesLine}`,
            `• Working Days: ${validated.calculatedDays} ${validated.calculatedDays === 1 ? 'day' : 'days'}`,
            `• Half Day: ${step.slots.isHalfDay ? 'Yes' : 'No'}`,
            `• Reason: ${step.slots.reason}`,
          ].join('\n');

          const pendingAction = pendingActions.createPendingAction({
            userId: req.user._id,
            tool: 'apply_leave',
            args: {
              leave_type_name: step.slots.leaveType,
              start_date: step.slots.startDate,
              end_date: step.slots.endDate,
              is_half_day: step.slots.isHalfDay,
              reason: step.slots.reason,
            },
            summary,
          });

          console.log(`[Chatbot] source=rules intent=APPLY_LEAVE_CONFIRM userId=${req.user._id}`);
          return res.json({
            reply: 'Please review and confirm your leave application below:',
            source: 'rules',
            pendingAction,
          });
        }

        console.log(`[Chatbot] source=rules intent=APPLY_SLOT_STEP userId=${req.user._id}`);
        return res.json({
          reply: step.reply,
          source: 'rules',
          pendingAction: null,
        });
      }

      if (activeSlotState.intent === 'REJECT') {
        const step = await slotFilling.processRejectSlotFilling(req.user, message, activeSlotState);
        if (step.complete) {
          const target = await dataService.getLeaveById(req.user, step.slots.leaveId);
          const startDisplay = formatDisplayDate(target.start_date);
          const endDisplay = formatDisplayDate(target.end_date);
          const startIso = formatISODate(target.start_date);
          const endIso = formatISODate(target.end_date);
          const datesLine =
            startIso === endIso
              ? `${startDisplay} (${startIso})`
              : `${startDisplay} (${startIso}) to ${endDisplay} (${endIso})`;

          const empName = target.employee_snapshot?.name || target.employee_name || 'Employee';
          const dept = target.employee_snapshot?.department || target.department || '';

          const summary = [
            `• Employee: ${empName}`,
            `• Department: ${dept}`,
            `• Leave Type: ${target.leave_type?.type_name || target.leave_type} Leave`,
            `• Dates: ${datesLine}`,
            `• Working Days: ${target.working_days} ${target.working_days === 1 ? 'day' : 'days'}`,
            `• Rejection Reason: ${step.slots.reason}`,
          ].join('\n');

          const pendingAction = pendingActions.createPendingAction({
            userId: req.user._id,
            tool: 'reject_leave',
            args: { leaveId: target._id.toString(), rejectionReason: step.slots.reason },
            summary,
          });

          console.log(`[Chatbot] source=rules intent=REJECT_CONFIRM userId=${req.user._id}`);
          return res.json({
            reply: 'Please review and confirm leave rejection below:',
            source: 'rules',
            pendingAction,
          });
        }

        return res.json({
          reply: step.reply,
          source: 'rules',
          pendingAction: null,
        });
      }
    }

    // ─── 2. Run Rule-Based Intent Engine ─────────────────────────────────────
    const match = matchIntent(normalized, req.user);

    if (match) {
      if (match.intent === 'CLARIFICATION') {
        console.log(`[Chatbot] source=rules intent=CLARIFICATION userId=${req.user._id}`);
        return res.json({
          reply: match.clarificationQuestion,
          source: 'rules',
          pendingAction: null,
        });
      }

      console.log(`[Chatbot] source=rules intent=${match.intent} userId=${req.user._id}`);
      const ruleResult = await intentHandlers.executeHandler(
        match.intent,
        req.user,
        match.entities,
        message
      );

      if (ruleResult) {
        const reply = typeof ruleResult === 'object' && ruleResult !== null ? ruleResult.reply : ruleResult;
        const pendingAction = typeof ruleResult === 'object' && ruleResult !== null ? ruleResult.pendingAction : null;
        const file = typeof ruleResult === 'object' && ruleResult !== null ? ruleResult.file : null;

        return res.json({
          reply,
          source: 'rules',
          pendingAction: pendingAction || null,
          file: file || null,
        });
      }
    }

    // ─── 2b. PDF Safety Net ──────────────────────────────────────────────────
    // If the message contains a PDF word (pdf, report, export, download) and the intent is unmatched,
    // do not send it to Gemini blindly. Ask clarifying question and save PDF slot state (5-minute TTL).
    if (slotFilling.isPdfKeywordMessage(message)) {
      slotFilling.setSlotState(req.user._id, {
        intent: 'PDF_EXPORT',
        slots: {},
      });
      console.log(`[Chatbot] source=rules intent=PDF_SAFETY_NET userId=${req.user._id}`);
      return res.json({
        reply: 'Which data should the PDF contain? For example: my leaves, my pending leaves, leaves in September.',
        source: 'rules',
        pendingAction: null,
      });
    }

    // ─── 3. Fall Back to Gemini ──────────────────────────────────────────────
    // 3a. Check per-user daily limit for Gemini calls
    const dailyCheck = geminiTracker.checkAndIncrementDailyLimit(req.user._id);
    if (!dailyCheck.allowed) {
      console.log(`[Chatbot] source=gemini_capped userId=${req.user._id} count=${dailyCheck.count}`);
      return res.json({
        reply: `You have reached your daily AI assistant message limit of ${dailyCheck.limit} messages. You can still use standard commands to check balances or apply for leaves.`,
        source: 'rules',
        pendingAction: null,
      });
    }

    // 3b. Check dedupe cache for identical query (60s TTL)
    const cachedReply = geminiTracker.getDedupeCache(req.user._id, req.user.role, normalized);
    if (cachedReply) {
      console.log(`[Chatbot] source=gemini_cache userId=${req.user._id}`);
      return res.json({
        reply: cachedReply,
        source: 'gemini',
        pendingAction: null,
      });
    }

    console.log(`[Chatbot] source=gemini intent=fallback userId=${req.user._id}`);
    const result = await chatService.handleChat({
      user: req.user,
      message,
      history,
    });

    // 3c. Cache result if no pendingAction write card was produced
    if (!result.pendingAction) {
      geminiTracker.setDedupeCache(req.user._id, req.user.role, normalized, result.reply);
    }

    return res.json({
      reply: result.reply,
      source: 'gemini',
      pendingAction: result.pendingAction || null,
      file: result.file || null,
    });
  } catch (err) {
    const status = err.status || 500;
    const message = err.message || 'Internal server error';
    return res.status(status).json({ message });
  }
};

/**
 * POST /api/chatbot/confirm
 * Executes or cancels a pending action.
 * Re-validates ownership, role, limits, status, balance, and overlap.
 */
const confirmAction = async (req, res, next) => {
  try {
    const { actionId, decision = 'confirm' } = req.body;
    if (!actionId) {
      return res.status(400).json({ message: 'Action ID is required' });
    }

    // Cancellation decision
    if (decision === 'cancel') {
      pendingActions.discardPendingAction(actionId, req.user._id);
      console.log(`[Chatbot] actionId=${actionId} cancelled by user=${req.user._id}`);
      return res.json({
        reply: 'Action cancelled.',
        source: 'rules',
        pendingAction: null,
      });
    }

    // Consume pending action (verifies existence, 5-min TTL, and user ownership)
    const { action, error, status } = pendingActions.consumePendingAction(actionId, req.user);
    if (error) {
      return res.status(status || 400).json({ message: error });
    }

    // Re-check everything and execute atomically
    switch (action.tool) {
      case 'apply_leave': {
        const created = await dataService.applyLeave(req.user, action.args);
        console.log(`[Chatbot] apply_leave executed by user=${req.user._id} leaveId=${created._id}`);
        const startStr = formatDisplayDate(created.start_date);
        const endStr = formatDisplayDate(created.end_date);
        return res.json({
          reply: `✅ Leave request successfully submitted! (${created.leave_type.type_name} leave from ${startStr} to ${endStr}, ${created.working_days} working days - Status: Pending).`,
          source: 'rules',
          refreshData: true,
          pendingAction: null,
        });
      }

      case 'cancel_leave': {
        await dataService.cancelLeave(req.user, action.args.leaveId);
        console.log(`[Chatbot] cancel_leave executed by user=${req.user._id} leaveId=${action.args.leaveId}`);
        return res.json({
          reply: '✅ Your leave request has been successfully cancelled.',
          source: 'rules',
          refreshData: true,
          pendingAction: null,
        });
      }

      case 'approve_leave': {
        const approved = await dataService.approveLeave(req.user, action.args.leaveId);
        console.log(`[Chatbot] approve_leave executed by admin=${req.user._id} leaveId=${action.args.leaveId}`);
        const empName = approved.employee_snapshot?.name || 'the employee';
        return res.json({
          reply: `✅ Leave request for ${empName} has been successfully approved.`,
          source: 'rules',
          refreshData: true,
          pendingAction: null,
        });
      }

      case 'reject_leave': {
        const rejected = await dataService.rejectLeave(
          req.user,
          action.args.leaveId,
          action.args.rejectionReason
        );
        console.log(`[Chatbot] reject_leave executed by admin=${req.user._id} leaveId=${action.args.leaveId}`);
        const empName = rejected.employee_snapshot?.name || 'the employee';
        return res.json({
          reply: `✅ Leave request for ${empName} has been rejected.`,
          source: 'rules',
          refreshData: true,
          pendingAction: null,
        });
      }

      default:
        return res.status(400).json({ message: `Unknown tool: ${action.tool}` });
    }
  } catch (err) {
    const status = err.status || 400;
    const message = err.message || 'Failed to execute action';
    return res.status(status).json({ message });
  }
};

/**
 * GET /api/chatbot/files/:id
 * Secure, owner-only PDF report download.
 */
const downloadPdfFile = async (req, res, next) => {
  try {
    const { id } = req.params;
    // Validate strict 64 hex chars (no path traversal possible)
    if (!id || !/^[a-f0-9]{64}$/.test(id)) {
      return res.status(400).json({ message: 'Invalid file identifier' });
    }

    const meta = pdfService.getFileMetadata(id);
    if (!meta) {
      return res.status(404).json({ message: 'Report not found or has expired.' });
    }

    // Check expiration
    if (Date.now() > meta.expiresAt) {
      pdfService.deleteFile(id);
      return res.status(410).json({
        message: 'This report has expired (download links are valid for 30 minutes). Please generate a new report.',
      });
    }

    // Owner verification: Admin does NOT get other users' files!
    if (String(meta.ownerId) !== String(req.user._id)) {
      return res.status(403).json({
        message: 'Access denied: You do not have permission to download this report.',
      });
    }

    const safePath = path.resolve(meta.filePath);
    if (!safePath.startsWith(pdfService.REPORTS_DIR) || !fs.existsSync(safePath)) {
      return res.status(404).json({ message: 'Report file not found on server.' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${meta.displayName}"`);
    const stream = fs.createReadStream(safePath);
    stream.pipe(res);
  } catch (err) {
    next(err);
  }
};

module.exports = {
  postChat,
  confirmAction,
  downloadPdfFile,
};
