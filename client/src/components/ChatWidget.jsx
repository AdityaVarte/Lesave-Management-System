import { useState, useRef, useEffect } from 'react';
import {
  MessageSquare, Send, X, Sparkles, Trash2, Bot, User, Loader2, RotateCcw,
  Check, AlertTriangle, Clock, FileText, Download,
} from 'lucide-react';
import api from '../api/axiosInstance';
import { useAppStore } from '../store/useAppStore';

export default function ChatWidget() {
  const {
    user,
    chatIsOpen,
    setChatIsOpen,
    chatMessages,
    addChatMessage,
    setChatMessages,
    chatIsLoading,
    setChatIsLoading,
    clearChat,
    addToast,
    triggerRefresh,
  } = useAppStore();

  const [input, setInput] = useState('');
  const [actionLoading, setActionLoading] = useState(null);
  const [actionStatus, setActionStatus] = useState({});
  const [downloadingId, setDownloadingId] = useState(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Quick prompt chips based on user role
  const quickChips = user?.role === 'admin'
    ? [
        "What's my leave balance?",
        'Show pending requests',
        'PDF of pending requests',
        'Department summary PDF',
        'Department leave summary',
        'Who is on leave today?',
      ]
    : [
        "What's my leave balance?",
        'Show my leaves',
        'PDF of my leaves',
        'Apply leave',
        'Cancel pending leave',
      ];

  // Auto-scroll to bottom on message change or typing
  useEffect(() => {
    if (chatIsOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, chatIsLoading, chatIsOpen]);

  // Focus input when opened
  useEffect(() => {
    if (chatIsOpen) {
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [chatIsOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && chatIsOpen) {
        setChatIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [chatIsOpen, setChatIsOpen]);

  const handleSend = async (messageToSend) => {
    const text = (messageToSend || input).trim();
    if (!text || chatIsLoading) return;

    setInput('');

    // Append user message locally
    addChatMessage({
      role: 'user',
      text,
      timestamp: new Date().toISOString(),
    });

    setChatIsLoading(true);

    try {
      // Build history payload strictly excluding error bubbles
      const validHistory = chatMessages.filter((m) => !m.isError);
      const historyPayload = validHistory.slice(-15).map((m) => ({
        role: m.role === 'user' ? 'user' : 'model',
        text: m.text,
      }));

      const res = await api.post(
        '/chatbot',
        {
          message: text,
          history: historyPayload,
        },
        { timeout: 30000 }
      );

      if (res.data?.reply) {
        addChatMessage({
          role: 'assistant',
          text: res.data.reply,
          pendingAction: res.data.pendingAction || null,
          file: res.data.file || null,
          source: res.data.source || 'rules',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          ? 'The assistant took too long to respond.'
          : 'The assistant is busy right now. Please try again in a moment.');
      addToast(errMsg, 'error');
      addChatMessage({
        role: 'assistant',
        text: errMsg,
        timestamp: new Date().toISOString(),
        isError: true,
      });
    } finally {
      setChatIsLoading(false);
    }
  };

  const handleConfirmAction = async (actionId, decision) => {
    if (actionLoading) return;
    setActionLoading(actionId);

    try {
      const res = await api.post('/chatbot/confirm', { actionId, decision });
      setActionStatus((prev) => ({
        ...prev,
        [actionId]: decision === 'confirm' ? 'confirmed' : 'cancelled',
      }));

      if (res.data?.reply) {
        addChatMessage({
          role: 'assistant',
          text: res.data.reply,
          source: 'rules',
          timestamp: new Date().toISOString(),
        });
      }

      if (res.data?.refreshData) {
        triggerRefresh();
      }
    } catch (err) {
      const errMsg = err.response?.data?.message || 'Failed to process confirmation.';
      if (err.response?.status === 410 || errMsg.toLowerCase().includes('expired')) {
        setActionStatus((prev) => ({ ...prev, [actionId]: 'expired' }));
      }
      addToast(errMsg, 'error');
      addChatMessage({
        role: 'assistant',
        text: errMsg,
        isError: true,
        timestamp: new Date().toISOString(),
      });
    } finally {
      setActionLoading(null);
    }
  };

  const handleRetry = async () => {
    if (chatIsLoading) return;

    // Locate the last user message to resend
    const lastUserMessage = [...chatMessages].reverse().find((m) => m.role === 'user');
    if (!lastUserMessage) return;

    // Remove error bubble(s)
    const cleanMessages = chatMessages.filter((m) => !m.isError);
    setChatMessages(cleanMessages);

    // Build history prior to the last user message, excluding error bubbles
    const lastUserIdx = cleanMessages.findIndex((m) => m.id === lastUserMessage.id);
    const priorHistory = lastUserIdx >= 0 ? cleanMessages.slice(0, lastUserIdx) : [];
    const historyPayload = priorHistory.slice(-15).map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      text: m.text,
    }));

    setChatIsLoading(true);

    try {
      const res = await api.post(
        '/chatbot',
        {
          message: lastUserMessage.text,
          history: historyPayload,
        },
        { timeout: 30000 }
      );

      if (res.data?.reply) {
        addChatMessage({
          role: 'assistant',
          text: res.data.reply,
          pendingAction: res.data.pendingAction || null,
          source: res.data.source || 'rules',
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err) {
      const errMsg =
        err.response?.data?.message ||
        (err.code === 'ECONNABORTED' || err.message?.includes('timeout')
          ? 'The assistant took too long to respond.'
          : 'The assistant is busy right now. Please try again in a moment.');
      addToast(errMsg, 'error');
      addChatMessage({
        role: 'assistant',
        text: errMsg,
        timestamp: new Date().toISOString(),
        isError: true,
      });
    } finally {
      setChatIsLoading(false);
    }
  };

  const handleDownloadFile = async (file) => {
    if (!file?.url || downloadingId) return;
    setDownloadingId(file.id);

    try {
      const response = await api.get(file.url, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/pdf' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.setAttribute('download', file.name || 'LeaveFlow-Report.pdf');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);
      addToast('Report downloaded successfully', 'success');
    } catch (err) {
      if (err.response?.status === 410) {
        addToast('This report has expired (download links are valid for 30 minutes). Please generate a new report.', 'error');
      } else if (err.response?.status === 404) {
        addToast('Report not found or has been cleaned up. Please generate a new report.', 'error');
      } else if (err.response?.status === 403) {
        addToast('Access denied: You do not have permission to download this report.', 'error');
      } else {
        addToast('Failed to download report. Please try again.', 'error');
      }
    } finally {
      setDownloadingId(null);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* ─── Floating Gold Launcher Button ─── */}
      <button
        onClick={() => setChatIsOpen(!chatIsOpen)}
        aria-label="Open LeaveFlow AI Assistant"
        style={{
          position: 'fixed',
          bottom: '24px',
          right: '24px',
          zIndex: 850,
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #c9a84c 0%, #e4b84d 100%)',
          border: 'none',
          boxShadow: '0 8px 24px rgba(201, 168, 76, 0.35)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#0c0b08',
          transition: 'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          transform: chatIsOpen ? 'scale(0.92)' : 'scale(1)',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08)';
          e.currentTarget.style.boxShadow = '0 12px 30px rgba(201, 168, 76, 0.5)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = chatIsOpen ? 'scale(0.92)' : 'scale(1)';
          e.currentTarget.style.boxShadow = '0 8px 24px rgba(201, 168, 76, 0.35)';
        }}
      >
        {chatIsOpen ? <X size={24} /> : <MessageSquare size={24} />}
      </button>

      {/* ─── Backdrop for Mobile ─── */}
      {chatIsOpen && (
        <div
          onClick={() => setChatIsOpen(false)}
          className="lg:hidden"
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 890,
            background: 'rgba(0,0,0,0.65)',
            backdropFilter: 'blur(4px)',
          }}
        />
      )}

      {/* ─── Slide-in Luxury Chat Panel ─── */}
      <div
        style={{
          position: 'fixed',
          bottom: '90px',
          right: '24px',
          zIndex: 900,
          width: '420px',
          maxWidth: 'calc(100vw - 32px)',
          height: '620px',
          maxHeight: 'calc(100vh - 120px)',
          background: '#111009',
          border: '1px solid #231e12',
          borderRadius: '16px',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.75), 0 0 1px rgba(201, 168, 76, 0.3)',
          overflow: 'hidden',
          transition: 'opacity 0.22s ease, transform 0.24s cubic-bezier(0.4, 0, 0.2, 1)',
          opacity: chatIsOpen ? 1 : 0,
          transform: chatIsOpen ? 'translateY(0) scale(1)' : 'translateY(16px) scale(0.96)',
          pointerEvents: chatIsOpen ? 'auto' : 'none',
        }}
      >
        {/* Top Gold Accent Border */}
        <div
          style={{
            height: '2px',
            background: 'linear-gradient(90deg, #c9a84c, #e4b84d 50%, transparent)',
            flexShrink: 0,
          }}
        />

        {/* ─── Header ─── */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #1a1610',
            background: '#141209',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'rgba(201, 168, 76, 0.12)',
                border: '1px solid rgba(201, 168, 76, 0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#e4b84d',
              }}
            >
              <Sparkles size={16} />
            </div>
            <div>
              <h3
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '18px',
                  fontWeight: 600,
                  color: '#f5f0e8',
                  lineHeight: 1.2,
                }}
              >
                LeaveFlow AI
              </h3>
              <p style={{ fontSize: '11px', color: '#9a9080' }}>
                HR & Leave Assistant • {user?.role === 'admin' ? 'Admin Mode' : 'Employee Mode'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {chatMessages.length > 0 && (
              <button
                onClick={clearChat}
                title="Clear conversation"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#5a5248',
                  padding: '6px',
                  borderRadius: '6px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#e06060';
                  e.currentTarget.style.background = '#231e12';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = '#5a5248';
                  e.currentTarget.style.background = 'none';
                }}
              >
                <Trash2 size={16} />
              </button>
            )}

            <button
              onClick={() => setChatIsOpen(false)}
              title="Close panel"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#5a5248',
                padding: '6px',
                borderRadius: '6px',
                display: 'flex',
                alignItems: 'center',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = '#f5f0e8';
                e.currentTarget.style.background = '#231e12';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = '#5a5248';
                e.currentTarget.style.background = 'none';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* ─── Messages List ─── */}
        <div
          className="custom-scrollbar"
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
          }}
        >
          {chatMessages.length === 0 ? (
            <div
              className="fade-in"
              style={{
                margin: 'auto 0',
                textAlign: 'center',
                padding: '20px 10px',
              }}
            >
              <div
                style={{
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  background: 'rgba(201, 168, 76, 0.1)',
                  border: '1px solid rgba(201, 168, 76, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e4b84d',
                  margin: '0 auto 12px',
                }}
              >
                <Bot size={22} />
              </div>
              <h4
                style={{
                  fontFamily: "'Cormorant Garamond', serif",
                  fontSize: '18px',
                  color: '#f5f0e8',
                  marginBottom: '6px',
                }}
              >
                Hello, {user?.name || 'there'}
              </h4>
              <p
                style={{
                  fontSize: '12px',
                  color: '#9a9080',
                  maxWidth: '280px',
                  margin: '0 auto 18px',
                  lineHeight: 1.5,
                }}
              >
                I can help you review your leaves, check balances, and manage requests.
              </p>

              {/* Suggested Quick Prompt Chips */}
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: '6px',
                  justifyContent: 'center',
                }}
              >
                {quickChips.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip)}
                    style={{
                      background: '#1a1710',
                      border: '1px solid #2e2716',
                      borderRadius: '20px',
                      padding: '6px 12px',
                      fontSize: '11px',
                      color: '#d4ccbf',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                      textAlign: 'left',
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#c9a84c';
                      e.currentTarget.style.color = '#f5f0e8';
                      e.currentTarget.style.background = '#221e14';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#2e2716';
                      e.currentTarget.style.color = '#d4ccbf';
                      e.currentTarget.style.background = '#1a1710';
                    }}
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            chatMessages.map((msg) => {
              const isUser = msg.role === 'user';
              return (
                <div
                  key={msg.id}
                  className="fade-in"
                  style={{
                    display: 'flex',
                    flexDirection: isUser ? 'row-reverse' : 'row',
                    gap: '8px',
                    alignItems: 'flex-start',
                  }}
                >
                  {/* Avatar */}
                  <div
                    style={{
                      width: '26px',
                      height: '26px',
                      borderRadius: '50%',
                      background: isUser ? '#2e2716' : 'rgba(201, 168, 76, 0.15)',
                      border: isUser ? '1px solid #443a22' : '1px solid rgba(201, 168, 76, 0.3)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: isUser ? '#d4ccbf' : '#e4b84d',
                      flexShrink: 0,
                      marginTop: '2px',
                    }}
                  >
                    {isUser ? <User size={14} /> : <Bot size={14} />}
                  </div>

                  {/* Message Bubble */}
                  <div
                    style={{
                      maxWidth: '82%',
                      padding: '10px 14px',
                      borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                      background: isUser
                        ? '#221e14'
                        : msg.isError
                        ? '#241414'
                        : '#18150e',
                      border: isUser
                        ? '1px solid #332c18'
                        : msg.isError
                        ? '1px solid #5a2020'
                        : '1px solid #231e12',
                      color: msg.isError ? '#f09090' : '#f5f0e8',
                      fontSize: '13px',
                      lineHeight: 1.55,
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                    }}
                  >
                    <div>{msg.text}</div>

                    {/* Pending Action Confirmation Card */}
                    {msg.pendingAction && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '12px',
                          borderRadius: '10px',
                          background: '#13110a',
                          border: '1px solid #332a18',
                          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
                        }}
                      >
                        {/* Summary Header */}
                        <div
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            marginBottom: '8px',
                            paddingBottom: '6px',
                            borderBottom: '1px solid #231e12',
                          }}
                        >
                          <span
                            style={{
                              fontFamily: "'Cormorant Garamond', serif",
                              fontSize: '13px',
                              fontWeight: 600,
                              color: '#e4b84d',
                              letterSpacing: '0.5px',
                              textTransform: 'uppercase',
                            }}
                          >
                            {msg.pendingAction.tool === 'apply_leave' && 'Leave Application Draft'}
                            {msg.pendingAction.tool === 'cancel_leave' && 'Cancellation Confirmation'}
                            {msg.pendingAction.tool === 'approve_leave' && 'Approval Confirmation'}
                            {msg.pendingAction.tool === 'reject_leave' && 'Rejection Confirmation'}
                          </span>
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                              fontSize: '10px',
                              color: '#8a8070',
                            }}
                          >
                            <Clock size={11} />
                            <span>5m limit</span>
                          </div>
                        </div>

                        {/* Summary Body */}
                        <div
                          style={{
                            fontSize: '12px',
                            color: '#d4ccbf',
                            lineHeight: 1.6,
                            whiteSpace: 'pre-wrap',
                            marginBottom: '10px',
                          }}
                        >
                          {msg.pendingAction.summary}
                        </div>

                        {/* Status or Action Buttons */}
                        {actionStatus[msg.pendingAction.id] === 'confirmed' ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(52, 199, 89, 0.12)',
                              border: '1px solid rgba(52, 199, 89, 0.3)',
                              color: '#34c759',
                              fontSize: '11px',
                              fontWeight: 500,
                            }}
                          >
                            <Check size={13} />
                            <span>Action Confirmed & Executed</span>
                          </div>
                        ) : actionStatus[msg.pendingAction.id] === 'cancelled' ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(255, 255, 255, 0.05)',
                              border: '1px solid #2e2716',
                              color: '#9a9080',
                              fontSize: '11px',
                            }}
                          >
                            <X size={13} />
                            <span>Action Cancelled</span>
                          </div>
                        ) : actionStatus[msg.pendingAction.id] === 'expired' || now > msg.pendingAction.expiresAt ? (
                          <div
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                              padding: '6px 10px',
                              borderRadius: '6px',
                              background: 'rgba(235, 87, 87, 0.1)',
                              border: '1px solid rgba(235, 87, 87, 0.25)',
                              color: '#e07070',
                              fontSize: '11px',
                            }}
                          >
                            <AlertTriangle size={13} />
                            <span>Confirmation Expired (5m TTL)</span>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                            <button
                              type="button"
                              onClick={() => handleConfirmAction(msg.pendingAction.id, 'confirm')}
                              disabled={actionLoading !== null}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: 'linear-gradient(135deg, #c9a84c, #e4b84d)',
                                border: 'none',
                                color: '#0c0b08',
                                fontSize: '11px',
                                fontWeight: 600,
                                cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                                opacity: actionLoading !== null ? 0.7 : 1,
                                transition: 'all 0.15s ease',
                              }}
                            >
                              {actionLoading === msg.pendingAction.id ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Check size={12} />
                              )}
                              <span>Confirm</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleConfirmAction(msg.pendingAction.id, 'cancel')}
                              disabled={actionLoading !== null}
                              style={{
                                flex: 1,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                padding: '6px 12px',
                                borderRadius: '6px',
                                background: '#1d1912',
                                border: '1px solid #332c18',
                                color: '#d4ccbf',
                                fontSize: '11px',
                                fontWeight: 500,
                                cursor: actionLoading !== null ? 'not-allowed' : 'pointer',
                                opacity: actionLoading !== null ? 0.7 : 1,
                                transition: 'all 0.15s ease',
                              }}
                              onMouseEnter={(e) => {
                                if (actionLoading === null) {
                                  e.currentTarget.style.borderColor = '#5a4a25';
                                  e.currentTarget.style.color = '#f5f0e8';
                                }
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.borderColor = '#332c18';
                                e.currentTarget.style.color = '#d4ccbf';
                              }}
                            >
                              <X size={12} />
                              <span>Cancel</span>
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {/* PDF Report File Card */}
                    {msg.file && (
                      <div
                        style={{
                          marginTop: '12px',
                          padding: '14px',
                          borderRadius: '10px',
                          background: '#13110a',
                          border: '1px solid #332a18',
                          boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                          <div
                            style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '8px',
                              background: 'rgba(201, 168, 76, 0.12)',
                              border: '1px solid rgba(201, 168, 76, 0.3)',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              color: '#e4b84d',
                              flexShrink: 0,
                            }}
                          >
                            <FileText size={18} />
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: '13px',
                                fontWeight: 600,
                                color: '#f5f0e8',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                              title={msg.file.name}
                            >
                              {msg.file.name}
                            </div>
                            <div style={{ fontSize: '11px', color: '#9a9080', marginTop: '2px' }}>
                              {msg.file.rows} record{msg.file.rows === 1 ? '' : 's'}
                              {msg.file.truncated ? ` (showing first 200 of ${msg.file.totalCount || 'many'})` : ''}
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '10px', color: '#c9a84c', marginTop: '4px' }}>
                              <Clock size={11} />
                              <span>Expires in 30 minutes</span>
                            </div>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleDownloadFile(msg.file)}
                          disabled={downloadingId === msg.file.id}
                          style={{
                            width: '100%',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '6px',
                            padding: '8px 14px',
                            borderRadius: '6px',
                            background: 'linear-gradient(135deg, #c9a84c 0%, #e4b84d 100%)',
                            border: 'none',
                            color: '#0c0b08',
                            fontSize: '12px',
                            fontWeight: 600,
                            cursor: downloadingId === msg.file.id ? 'not-allowed' : 'pointer',
                            opacity: downloadingId === msg.file.id ? 0.75 : 1,
                            boxShadow: '0 2px 8px rgba(201, 168, 76, 0.25)',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (downloadingId !== msg.file.id) {
                              e.currentTarget.style.boxShadow = '0 4px 14px rgba(201, 168, 76, 0.45)';
                              e.currentTarget.style.transform = 'translateY(-1px)';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(201, 168, 76, 0.25)';
                            e.currentTarget.style.transform = 'translateY(0)';
                          }}
                        >
                          {downloadingId === msg.file.id ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Downloading...</span>
                            </>
                          ) : (
                            <>
                              <Download size={13} />
                              <span>Download PDF</span>
                            </>
                          )}
                        </button>
                      </div>
                    )}

                    {msg.isError && (
                      <div style={{ marginTop: '8px' }}>
                        <button
                          type="button"
                          onClick={() => handleRetry()}
                          disabled={chatIsLoading}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '4px 10px',
                            fontSize: '11px',
                            fontWeight: 500,
                            borderRadius: '6px',
                            background: 'rgba(201, 168, 76, 0.15)',
                            border: '1px solid rgba(201, 168, 76, 0.35)',
                            color: '#e4b84d',
                            cursor: chatIsLoading ? 'not-allowed' : 'pointer',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            if (!chatIsLoading) {
                              e.currentTarget.style.background = 'rgba(201, 168, 76, 0.25)';
                              e.currentTarget.style.borderColor = '#e4b84d';
                            }
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.background = 'rgba(201, 168, 76, 0.15)';
                            e.currentTarget.style.borderColor = 'rgba(201, 168, 76, 0.35)';
                          }}
                        >
                          <RotateCcw size={12} className={chatIsLoading ? 'animate-spin' : ''} />
                          <span>Retry</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {/* Typing Indicator */}
          {chatIsLoading && (
            <div
              className="fade-in"
              style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'rgba(201, 168, 76, 0.15)',
                  border: '1px solid rgba(201, 168, 76, 0.3)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#e4b84d',
                  flexShrink: 0,
                }}
              >
                <Bot size={14} />
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  borderRadius: '14px 14px 14px 2px',
                  background: '#18150e',
                  border: '1px solid #231e12',
                  display: 'flex',
                  gap: '4px',
                  alignItems: 'center',
                }}
              >
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#c9a84c',
                    animation: 'pulse 1s infinite alternate',
                  }}
                />
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#c9a84c',
                    animation: 'pulse 1s infinite alternate 0.2s',
                  }}
                />
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: '#c9a84c',
                    animation: 'pulse 1s infinite alternate 0.4s',
                  }}
                />
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ─── Input Bar ─── */}
        <div
          style={{
            padding: '12px 16px',
            borderTop: '1px solid #1a1610',
            background: '#141209',
            flexShrink: 0,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-end',
              gap: '8px',
              background: '#0c0b08',
              border: '1px solid #231e12',
              borderRadius: '12px',
              padding: '8px 12px',
              transition: 'border-color 0.15s',
            }}
            onFocus={(e) => {
              e.currentTarget.style.borderColor = '#c9a84c';
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = '#231e12';
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask about leave balances or requests..."
              disabled={chatIsLoading}
              style={{
                flex: 1,
                background: 'none',
                border: 'none',
                outline: 'none',
                color: '#f5f0e8',
                fontSize: '13px',
                fontFamily: "'DM Sans', sans-serif",
                resize: 'none',
                maxHeight: '100px',
                lineHeight: '1.4',
              }}
            />

            <button
              onClick={() => handleSend()}
              disabled={!input.trim() || chatIsLoading}
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background:
                  !input.trim() || chatIsLoading
                    ? '#231e12'
                    : 'linear-gradient(135deg, #c9a84c, #e4b84d)',
                color: !input.trim() || chatIsLoading ? '#5a5248' : '#0c0b08',
                border: 'none',
                cursor: !input.trim() || chatIsLoading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'all 0.15s',
              }}
            >
              {chatIsLoading ? <Loader2 size={16} className="animate-spin" /> : <Send size={15} />}
            </button>
          </div>
          <div
            style={{
              fontSize: '10px',
              color: '#5a5248',
              textAlign: 'center',
              marginTop: '6px',
            }}
          >
            Press Enter to send • Shift + Enter for new line
          </div>
        </div>
      </div>
    </>
  );
}
