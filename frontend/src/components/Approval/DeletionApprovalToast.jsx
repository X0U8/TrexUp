import { useState, useEffect, useRef } from 'react';
import './DeletionApprovalToast.css';

export default function DeletionApprovalToast({ approval, onDecision }) {
  const duration = approval?.timeoutSeconds || 30;
  const [timeLeft, setTimeLeft] = useState(duration);
  const decisionMadeRef = useRef(false);

  useEffect(() => {
    setTimeLeft(duration);
    decisionMadeRef.current = false;

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          if (!decisionMadeRef.current) {
            decisionMadeRef.current = true;
            onDecision?.(false);
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [approval?.id, duration, onDecision]);

  if (!approval) return null;

  const handleApprove = () => {
    if (decisionMadeRef.current) return;
    decisionMadeRef.current = true;
    onDecision?.(true);
  };

  const handleDeny = () => {
    if (decisionMadeRef.current) return;
    decisionMadeRef.current = true;
    onDecision?.(false);
  };

  const badgeLabel = approval?.badge || 'AI deletion request';
  const questionText = approval?.question || `Delete ${approval?.itemLabel || 'item'}?`;
  const subtext = approval?.subtext || 'Action will be denied automatically if not approved.';

  return (
    <div className="deletion-approval-bar" role="alert">
      <div className="approval-bar-header">
        <span className="approval-badge">{badgeLabel}</span>
        <span className="approval-timer">{timeLeft}s remaining</span>
      </div>

      <div className="approval-bar-body">
        <span className="approval-question">{questionText}</span>
        <span className="approval-subtext">{subtext}</span>
      </div>

      <div className="approval-bar-progress">
        <div
          className="approval-bar-fill"
          style={{ width: `${(timeLeft / duration) * 100}%` }}
        />
      </div>

      <div className="approval-bar-actions">
        <button
          type="button"
          className="approval-btn-deny"
          onClick={handleDeny}
        >
          Deny
        </button>
        <button
          type="button"
          className="approval-btn-approve"
          onClick={handleApprove}
        >
          Approve
        </button>
      </div>
    </div>
  );
}
