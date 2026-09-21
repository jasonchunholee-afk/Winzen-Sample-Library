import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Play, 
  RotateCcw, 
  CheckCircle2, 
  AlertTriangle, 
  Layers, 
  Sparkles, 
  Copy, 
  Check, 
  ChevronDown,
  ChevronUp,
  Plus,
  Terminal,
  Clock,
  Square,
  MessageSquare,
  Edit3,
  BookmarkPlus,
  Send,
  Sliders,
  Filter,
  CheckCircle,
  AlertCircle,
  ShieldCheck,
  Loader2,
  Wand2,
  Brain,
  Bot,
  ArrowRight,
  Archive,
  Trash2
} from 'lucide-react';

export * from './fgd/types';
import {
  FgdLabelData,
  FgdData,
  FgdDiffItem,
  RuleAmendment,
  DbLabelingRule,
  LoopResult,
  GarmentTestReport,
  LibraryGarment,
  FgdJobLog,
  FgdJobState
} from './fgd/types';
import { FgdControlHeader } from './fgd/FgdControlHeader';
import { FgdExecutionHud } from './fgd/FgdExecutionHud';
import { FgdRuleAmendmentsCard } from './fgd/FgdRuleAmendmentsCard';
import { FgdArchiveSelector } from './fgd/FgdArchiveSelector';
import { FgdScorecardHero } from './fgd/FgdScorecardHero';
import { FgdMerchandiserFeedback } from './fgd/FgdMerchandiserFeedback';
import { FgdArchivedRulesModal } from './fgd/FgdArchivedRulesModal';
import { FgdWipePendingModal } from './fgd/FgdWipePendingModal';

export function FgdTestMode({ onRuleApplied }: { onRuleApplied?: () => void }) {
  const [libraryGarments, setLibraryGarments] = useState<LibraryGarment[]>([]);
  const [selectedGarmentId, setSelectedGarmentId] = useState<string>('all');
  const [maxLoops, setMaxLoops] = useState<number>(2);

  // Background Job & Polling State
  const [activeJob, setActiveJob] = useState<FgdJobState | null>(null);
  const [running, setRunning] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [logs, setLogs] = useState<FgdJobLog[]>([]);
  const [reports, setReports] = useState<GarmentTestReport[]>(() => {
    try {
      const cached = localStorage.getItem('winzen_fgd_saved_reports');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return [];
  });
  const [selectedReportIndex, setSelectedReportIndex] = useState<number>(0);

  // Sync reports to localStorage for persistent tab-switch/reload recovery
  useEffect(() => {
    if (reports.length > 0) {
      try {
        localStorage.setItem('winzen_fgd_saved_reports', JSON.stringify(reports));
      } catch (e) {}
    }
  }, [reports]);

  // UI Toggles & Commentary States
  const [showLogsPanel, setShowLogsPanel] = useState<boolean>(true);
  const [logFilter, setLogFilter] = useState<'ALL' | 'STEP' | 'ERROR'>('ALL');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);
  const [appliedRules, setAppliedRules] = useState<Set<string>>(new Set());
  const [sessionApprovedCodes, setSessionApprovedCodes] = useState<Set<string>>(new Set());
  const [dbRules, setDbRules] = useState<DbLabelingRule[]>([]);
  const [showArchivedModal, setShowArchivedModal] = useState<boolean>(false);
  const [isRecallingCode, setIsRecallingCode] = useState<string | null>(null);
  const [expandedLoopArchives, setExpandedLoopArchives] = useState<Record<number, boolean>>({});

  // A rule is considered approved ONLY if:
  // 1. Explicitly marked approved on the rule object: (rule as any).is_approved === true
  // 2. Approved in the current session: sessionApprovedCodes.has(rule.rule_code)
  // 3. Exists as an active rule in the DB with matching target_field and matching content
  const isRuleApproved = useCallback((rule: RuleAmendment): boolean => {
    if ((rule as any).is_approved === true) return true;
    if (sessionApprovedCodes.has(rule.rule_code)) return true;
    const dbMatch = dbRules.find(d => d.rule_code === rule.rule_code && d.is_active);
    if (!dbMatch) return false;
    const sameTarget = dbMatch.target_field === rule.target_field;
    const sameTitle = dbMatch.rule_title.toLowerCase().trim() === rule.rule_title.toLowerCase().trim();
    const sameInstruction = dbMatch.rule_instruction.trim().slice(0, 30) === rule.rule_instruction.trim().slice(0, 30);
    return sameTarget && (sameTitle || sameInstruction);
  }, [dbRules, sessionApprovedCodes]);
  
  // Rule editing / commenting state dictionary { [rule_code]: { comment, instruction, editing } }
  const [ruleEdits, setRuleEdits] = useState<Record<string, {
    isEditing: boolean;
    user_comment: string;
    rule_title: string;
    rule_instruction: string;
    condition_trigger: string;
    target_field: string;
  }>>({});

  // Natural Language Merchandiser Commentary & AI Digestion State
  const [generalCommentary, setGeneralCommentary] = useState<string>('');
  const [isDigestingGeneral, setIsDigestingGeneral] = useState<boolean>(false);
  const [digestedRules, setDigestedRules] = useState<RuleAmendment[]>([]);
  const [digestingSingleCode, setDigestingSingleCode] = useState<string | null>(null);
  const [digestedFeedbackSuccess, setDigestedFeedbackSuccess] = useState<string | null>(null);

  // Conversational Discussion / Recorrection Threads per rule
  const [ruleThreads, setRuleThreads] = useState<Record<string, {
    isOpen: boolean;
    feedback: string;
    isThinking: boolean;
    messages: Array<{ sender: 'user' | 'ai'; text: string; recommendation?: string }>;
  }>>({});
  const [approvingCode, setApprovingCode] = useState<string | null>(null);
  const [approvalOutcomeMessage, setApprovalOutcomeMessage] = useState<Record<string, string>>({});

  // Pending Rules Wiping & Discarding State
  const [showWipeModal, setShowWipeModal] = useState<boolean>(false);
  const [isWipingRules, setIsWipingRules] = useState<boolean>(false);
  const [wipeScope, setWipeScope] = useState<'last_round' | 'current' | 'all'>('last_round');
  const [wipeNotification, setWipeNotification] = useState<{ message: string; count: number } | null>(null);

  const logsEndRef = useRef<HTMLDivElement | null>(null);
  const pollingRef = useRef<number | null>(null);

  // Fetch library garments on load
  useEffect(() => {
    fetch('/api/developer/fgd-test/library-garments')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data)) {
          setLibraryGarments(data);
        }
      })
      .catch(err => console.error("Failed to load library garments:", err));
  }, []);

  // Hydrate rules and active status directly from PostgreSQL database
  const loadRulesFromDb = useCallback(async () => {
    try {
      const res = await fetch('/api/developer/fgd-test/rules');
      const data = await res.json();
      if (data.success && Array.isArray(data.rules)) {
        setDbRules(data.rules);
        const activeCodes = new Set<string>(
          data.rules.filter((r: DbLabelingRule) => r.is_active).map((r: DbLabelingRule) => r.rule_code)
        );
        setAppliedRules(activeCodes);
      }
    } catch (err) {
      console.error("Failed to load labeling rules from DB:", err);
    }
  }, []);

  useEffect(() => {
    loadRulesFromDb();
  }, [loadRulesFromDb]);

  // Recall rule from active archive back into pending review
  const handleRecallRule = async (ruleCode: string) => {
    setIsRecallingCode(ruleCode);
    try {
      const res = await fetch('/api/developer/fgd-test/unapply-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleCode })
      });
      const data = await res.json();
      if (data.success) {
        setAppliedRules(prev => {
          const next = new Set(prev);
          next.delete(ruleCode);
          return next;
        });
        setSessionApprovedCodes(prev => {
          const next = new Set(prev);
          next.delete(ruleCode);
          return next;
        });
        setReports(prev => prev.map(rep => ({
          ...rep,
          loops: rep.loops?.map(loop => ({
            ...loop,
            amended_rules: loop.amended_rules?.map(r => r.rule_code === ruleCode ? { ...r, is_approved: false } : r)
          }))
        })));
        await loadRulesFromDb();
      } else {
        alert(data.error || "Failed to recall rule.");
      }
    } catch (err) {
      console.error("Error recalling rule:", err);
      alert("Failed to recall rule.");
    } finally {
      setIsRecallingCode(null);
    }
  };

  // Re-archive rule back to active status in DB
  const handleReapplyRule = async (ruleCode: string) => {
    setIsRecallingCode(ruleCode);
    try {
      const res = await fetch('/api/developer/fgd-test/reapply-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ruleCode })
      });
      const data = await res.json();
      if (data.success) {
        setAppliedRules(prev => new Set(prev).add(ruleCode));
        await loadRulesFromDb();
      } else {
        alert(data.error || "Failed to re-archive rule.");
      }
    } catch (err) {
      console.error("Error re-archiving rule:", err);
      alert("Failed to re-archive rule.");
    } finally {
      setIsRecallingCode(null);
    }
  };

  // Sync with active background job & saved reports on component mount
  useEffect(() => {
    fetch('/api/developer/fgd-test/job/active')
      .then(res => res.json())
      .then(data => {
        if (data.activeJob) {
          const job: FgdJobState = data.activeJob;
          setActiveJob(job);
          if (job.logs && job.logs.length > 0) {
            setLogs(job.logs);
          }
          if (Array.isArray(job.reports) && job.reports.length > 0) {
            setReports(job.reports);
          }
          if (job.status === 'running') {
            setRunning(true);
            setElapsedSeconds(job.elapsedSeconds || 0);
          }
        }
        if (Array.isArray(data.savedReports) && data.savedReports.length > 0) {
          setReports(prev => prev.length > 0 ? prev : data.savedReports);
        }
      })
      .catch(err => console.error("Failed to query active background job:", err));

    // Direct endpoint check for saved reports on server disk
    fetch('/api/developer/fgd-test/reports')
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.reports) && data.reports.length > 0) {
          setReports(data.reports);
        }
      })
      .catch(err => console.error("Failed to load saved reports:", err));
  }, []);

  // Continuous background job status polling loop
  useEffect(() => {
    if (!running) {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    const checkJobStatus = async () => {
      try {
        const url = activeJob?.id 
          ? `/api/developer/fgd-test/job/status?jobId=${activeJob.id}`
          : '/api/developer/fgd-test/job/status';
        
        const res = await fetch(url);
        const data = await res.json();
        const job: FgdJobState | null = data.job;

        if (job) {
          setActiveJob(job);
          setElapsedSeconds(job.elapsedSeconds || 0);
          if (job.logs && job.logs.length > 0) {
            setLogs(job.logs);
          }
          if (Array.isArray(job.reports) && job.reports.length > 0) {
            setReports(job.reports);
          }

          if (job.status === 'completed' || job.status === 'failed' || job.status === 'aborted') {
            setRunning(false);
            if (job.reports && job.reports.length > 0) {
              setSelectedReportIndex(0);
            }
          }
        }
      } catch (e) {
        console.warn("[FGD Poller] Polling cycle warning:", e);
      }
    };

    // Run immediately once, then schedule interval
    checkJobStatus();
    pollingRef.current = window.setInterval(checkJobStatus, 1000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [running, activeJob?.id]);

  // Local tick timer for smooth sub-second updates while running
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => {
      setElapsedSeconds(prev => Math.round((prev + 0.1) * 10) / 10);
    }, 100);
    return () => clearInterval(timer);
  }, [running]);

  // Auto-scroll logs
  useEffect(() => {
    if (showLogsPanel && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs.length, showLogsPanel]);

  // Format seconds to mm:ss.s
  const formatTimer = (sec: number): string => {
    const mins = Math.floor(sec / 60);
    const secs = (sec % 60).toFixed(1);
    const paddedSecs = parseFloat(secs) < 10 ? `0${secs}` : secs;
    const paddedMins = mins < 10 ? `0${mins}` : `${mins}`;
    return `${paddedMins}:${paddedSecs}`;
  };

  // Garments with 'Approved' status (FGD Test Mode only runs approved garments for the full library)
  const approvedGarments = libraryGarments.filter(g => g.status === 'Approved');
  // Garments awaiting merchandiser review (status is not 'Approved')
  const underReviewGarments = libraryGarments.filter(g => g.status !== 'Approved');

  const handleStartSuite = async () => {
    setRunning(true);
    setElapsedSeconds(0);
    setLogs([]);
    setReports([]);
    setShowLogsPanel(true);

    try {
      const isReviewRun = selectedGarmentId === 'under_review';
      let targetIds: string[] = [];
      if (isReviewRun) {
        targetIds = underReviewGarments.map(g => g.id);
      } else if (selectedGarmentId === 'all') {
        // Under FGD Test Mode, only run garments that have been approved
        targetIds = approvedGarments.map(g => g.id);
      } else {
        targetIds = [selectedGarmentId];
      }

      if (targetIds.length === 0) {
        if (selectedGarmentId === 'all') {
          alert("No approved garments found in the library. FGD Test Mode runs only approved garments.");
        } else {
          alert("No target garments found for selected filter.");
        }
        setRunning(false);
        return;
      }

      const res = await fetch('/api/developer/fgd-test/job/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          garmentIds: targetIds, 
          maxLoops: isReviewRun ? 1 : maxLoops,
          isReviewRun
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
        setLogs(data.job.logs || []);
      }
    } catch (err: any) {
      console.error("Test mode execution error:", err);
      alert(`Could not start background test suite: ${err.message}`);
      setRunning(false);
    }
  };

  // Explicitly Re-run FGD for garments currently under review (strictly 1 loop, zero candidate rules, routing questions to Jennifer & Jason)
  const handleRerunUnderReview = async () => {
    const targetIds = underReviewGarments.map(g => g.id);
    if (targetIds.length === 0) {
      alert("No garments are currently under review (all garments in library are marked as Approved).");
      return;
    }

    setRunning(true);
    setElapsedSeconds(0);
    setLogs([]);
    setReports([]);
    setShowLogsPanel(true);

    try {
      const res = await fetch('/api/developer/fgd-test/job/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          garmentIds: targetIds, 
          maxLoops: 1,
          isReviewRun: true 
        })
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const data = await res.json();
      if (data.job) {
        setActiveJob(data.job);
        setLogs(data.job.logs || []);
      }
    } catch (err: any) {
      console.error("FGD Re-run for garments under review error:", err);
      alert(`Could not start FGD for garments under review: ${err.message}`);
      setRunning(false);
    }
  };

  const handleStopSuite = async () => {
    if (!activeJob?.id) return;
    try {
      await fetch('/api/developer/fgd-test/job/cancel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: activeJob.id })
      });
      setRunning(false);
    } catch (err) {
      console.error("Failed to cancel test job:", err);
    }
  };

  const getRuleEditState = (rule: RuleAmendment) => {
    return ruleEdits[rule.rule_code] || {
      isEditing: false,
      user_comment: rule.user_comment || '',
      rule_title: rule.rule_title,
      rule_instruction: rule.rule_instruction,
      condition_trigger: rule.condition_trigger,
      target_field: rule.target_field
    };
  };

  const updateRuleEdit = (code: string, fields: Partial<ReturnType<typeof getRuleEditState>>) => {
    setRuleEdits(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || {
          isEditing: false,
          user_comment: '',
          rule_title: '',
          rule_instruction: '',
          condition_trigger: '',
          target_field: ''
        }),
        ...fields
      }
    }));
  };

  // Quick Preset for Hugo Boss permanent brand architecture requested by user
  const applyHugoBossPreset = (rule: RuleAmendment) => {
    updateRuleEdit(rule.rule_code, {
      isEditing: true,
      rule_title: "Hugo Boss Permanent Brand Architecture (HUGO vs BOSS)",
      rule_instruction: "Classify strictly into the permanent brand architecture: 'HUGO' (Gen Z / progressive streetwear / red logo / standalone retail stores) or 'BOSS' (contemporary luxury / tailoring / camel-black-white branding, including sub-lines BOSS Black, BOSS Orange, BOSS Green). This corporate restructuring is permanent, not a temporal line.",
      condition_trigger: "Label identifies Hugo Boss / HB, or displays 'HUGO' or 'BOSS' typography.",
      target_field: "buyer",
      user_comment: "Hugo Boss restructured into two distinct brand pillars: 'HUGO' and 'BOSS'. They have separate retail stores, differing design languages, and distinct target demographics. This is a permanent brand architecture, not a temporal line."
    });
  };

  // Compute total unapproved pending rules count across active reports
  const totalPendingRulesCount = React.useMemo(() => {
    let count = 0;
    for (const rep of reports) {
      if (rep.loops) {
        for (const loop of rep.loops) {
          if (loop.amended_rules) {
            count += loop.amended_rules.filter(r => !isRuleApproved(r)).length;
          }
        }
      }
    }
    return count;
  }, [reports, isRuleApproved]);

  // Wipes unapproved pending rules generated from the last round of evaluation
  const handleConfirmWipe = async (scopeToWipe: 'last_round' | 'current' | 'all' = wipeScope) => {
    setIsWipingRules(true);
    try {
      const targetGarmentId = scopeToWipe === 'current' ? (reports[selectedReportIndex]?.garment_id || reports[0]?.garment_id) : undefined;
      const res = await fetch('/api/developer/fgd-test/rules/wipe-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          scope: scopeToWipe === 'current' ? 'garment' : scopeToWipe,
          garmentId: targetGarmentId 
        })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to wipe pending rules');
      }

      // Update reports state with refreshed reports from server
      if (Array.isArray(data.updatedReports)) {
        setReports(data.updatedReports);
        try {
          localStorage.setItem('winzen_fgd_saved_reports', JSON.stringify(data.updatedReports));
        } catch (e) {
          console.warn('[FGD] Failed to sync localStorage:', e);
        }
      } else {
        // Optimistically remove pending rules from local reports state
        setReports(prev => prev.map(rep => {
          if (scopeToWipe === 'current' && rep.garment_id !== targetGarmentId) return rep;
          return {
            ...rep,
            loops: rep.loops?.map(loop => ({
              ...loop,
              amended_rules: loop.amended_rules?.filter(r => isRuleApproved(r)) || []
            })) || [],
            cumulative_rule_amendments: rep.cumulative_rule_amendments?.filter(r => isRuleApproved(r)) || []
          };
        }));
      }

      // Clear any rule edits or discussion threads for wiped rules
      if (data.wipedRuleCodes && Array.isArray(data.wipedRuleCodes)) {
        setRuleEdits(prev => {
          const next = { ...prev };
          data.wipedRuleCodes.forEach((c: string) => delete next[c]);
          return next;
        });
        setRuleThreads(prev => {
          const next = { ...prev };
          data.wipedRuleCodes.forEach((c: string) => delete next[c]);
          return next;
        });
      }

      setShowWipeModal(false);
      setWipeNotification({
        message: data.message || `Successfully wiped ${data.wipedCount} pending rule(s).`,
        count: data.wipedCount || 0
      });
      setTimeout(() => setWipeNotification(null), 7000);
    } catch (err: any) {
      alert(`Failed to wipe pending rules: ${err.message || err}`);
    } finally {
      setIsWipingRules(false);
    }
  };

  const currentReport = reports[selectedReportIndex] || null;

  const handleApplyRule = async (rule: RuleAmendment) => {
    const edit = getRuleEditState(rule);
    const payloadRule = {
      ...rule,
      rule_title: edit.rule_title || rule.rule_title,
      rule_instruction: edit.rule_instruction || rule.rule_instruction,
      condition_trigger: edit.condition_trigger || rule.condition_trigger,
      target_field: edit.target_field || rule.target_field,
      user_comment: edit.user_comment || rule.user_comment || undefined
    };

    try {
      const res = await fetch('/api/developer/fgd-test/apply-rule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rule: payloadRule })
      });
      if (res.ok) {
        setAppliedRules(prev => new Set(prev).add(rule.rule_code));
        updateRuleEdit(rule.rule_code, { isEditing: false });
        setApprovalOutcomeMessage(prev => ({
          ...prev,
          [rule.rule_code]: `Rule ${rule.rule_code} active in DB. You can approve more rules, then click "Re-run FGD for garments under review" at the top when you are done.`
        }));
        await loadRulesFromDb();
        if (onRuleApplied) onRuleApplied();
      } else {
        alert("Failed to apply rule to database.");
      }
    } catch (err) {
      console.error("Error applying rule:", err);
    }
  };

  // Unified AI Deduction Approval & Observation Archival (Zero-Cognitive Overhead)
  const handleApproveAiDeduction = async (rule: RuleAmendment) => {
    setApprovingCode(rule.rule_code);
    try {
      const edit = getRuleEditState(rule);
      const isHugoBossBuyer = (rule.target_field === 'buyer' || edit.target_field === 'buyer' || /hugo|boss/i.test(rule.rule_title) || /hugo|boss/i.test(rule.rule_instruction)) && (currentReport?.original_fgd?.label?.buyer?.toLowerCase().includes('hugo') || /hugo|boss/i.test(rule.rule_title));
      
      const payload = {
        rule: {
          ...rule,
          rule_title: edit.rule_title || rule.rule_title,
          rule_instruction: edit.rule_instruction || rule.rule_instruction,
          condition_trigger: edit.condition_trigger || rule.condition_trigger,
          target_field: edit.target_field || rule.target_field,
        },
        userComment: edit.user_comment || rule.user_comment,
        garmentId: currentReport?.garment_id || '11S-1906',
        customerName: isHugoBossBuyer ? 'HUGO BOSS' : (currentReport?.original_fgd?.label?.buyer || 'GENERAL'),
        scope: isHugoBossBuyer ? 'customer_specific' : (currentReport?.original_fgd?.label?.buyer ? 'customer_specific' : 'global'),
        aiDeduction: isHugoBossBuyer 
          ? "Customer-Specific Rule: Permanent Brand Architecture. Classified into two independent permanent brand pillars with separate retail & design ecosystems. Must not be collapsed into generic 'HB' or treated as temporal/seasonal lines."
          : (edit.user_comment || rule.rule_title)
      };

      const res = await fetch('/api/developer/fgd-test/approve-ai-deduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        setAppliedRules(prev => new Set(prev).add(rule.rule_code));
        setSessionApprovedCodes(prev => new Set(prev).add(rule.rule_code));
        setReports(prev => prev.map(rep => ({
          ...rep,
          loops: rep.loops?.map(loop => ({
            ...loop,
            amended_rules: loop.amended_rules?.map(r => r.rule_code === rule.rule_code ? { ...r, is_approved: true } : r)
          }))
        })));
        setApprovalOutcomeMessage(prev => ({
          ...prev,
          [rule.rule_code]: data.outcomeSummary || `Rule approved & active in DB! You can continue approving all rules first. When ready, click "Re-run FGD for garments under review" at the top.`
        }));
        await loadRulesFromDb();
        if (onRuleApplied) onRuleApplied();
      } else {
        alert(data.error || "Failed to approve AI deduction.");
      }
    } catch (err: any) {
      console.error("Failed to approve deduction:", err);
      alert("Error approving AI deduction.");
    } finally {
      setApprovingCode(null);
    }
  };

  const toggleRuleThread = (code: string) => {
    setRuleThreads(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || { feedback: '', isThinking: false, messages: [] }),
        isOpen: !prev[code]?.isOpen
      }
    }));
  };

  const updateRuleFeedback = (code: string, feedback: string) => {
    setRuleThreads(prev => ({
      ...prev,
      [code]: {
        ...(prev[code] || { feedback: '', isThinking: false, messages: [] }),
        feedback
      }
    }));
  };

  const handleSendRecorrection = async (rule: RuleAmendment) => {
    const thread = ruleThreads[rule.rule_code];
    if (!thread || !thread.feedback.trim()) return;

    const userText = thread.feedback.trim();
    setRuleThreads(prev => ({
      ...prev,
      [rule.rule_code]: {
        ...prev[rule.rule_code],
        isThinking: true,
        feedback: '',
        messages: [...(prev[rule.rule_code]?.messages || []), { sender: 'user', text: userText }]
      }
    }));

    try {
      const edit = getRuleEditState(rule);
      const res = await fetch('/api/developer/fgd-test/recorrect-deduction', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          feedback: userText,
          currentRule: {
            ...rule,
            rule_title: edit.rule_title,
            rule_instruction: edit.rule_instruction,
            condition_trigger: edit.condition_trigger,
            target_field: edit.target_field
          },
          currentDeduction: rule.rule_title,
          garmentId: currentReport?.garment_id || '11S-1906'
        })
      });
      const data = await res.json();
      if (data.success && data.conversational_response) {
        if (data.updated_rule) {
          updateRuleEdit(rule.rule_code, {
            rule_title: data.updated_rule.rule_title || edit.rule_title,
            rule_instruction: data.updated_rule.rule_instruction || edit.rule_instruction,
            condition_trigger: data.updated_rule.condition_trigger || edit.condition_trigger,
            target_field: data.updated_rule.target_field || edit.target_field
          });
        }
        setRuleThreads(prev => ({
          ...prev,
          [rule.rule_code]: {
            ...prev[rule.rule_code],
            isThinking: false,
            messages: [
              ...(prev[rule.rule_code]?.messages || []),
              { 
                sender: 'ai', 
                text: data.conversational_response,
                recommendation: data.recommendation 
              }
            ]
          }
        }));
      } else {
        setRuleThreads(prev => ({
          ...prev,
          [rule.rule_code]: {
            ...prev[rule.rule_code],
            isThinking: false,
            messages: [
              ...(prev[rule.rule_code]?.messages || []),
              { sender: 'ai', text: "I processed your guidance and updated the rule context. Feel free to review the deduction and approve when satisfied." }
            ]
          }
        }));
      }
    } catch (err: any) {
      console.error("Error sending recorrection:", err);
      setRuleThreads(prev => ({
        ...prev,
        [rule.rule_code]: {
          ...prev[rule.rule_code],
          isThinking: false,
          messages: [
            ...(prev[rule.rule_code]?.messages || []),
            { sender: 'ai', text: "Sorry, I ran into an issue connecting with the model. Please check the prompt or try again." }
          ]
        }
      }));
    }
  };

  const handleDigestGeneralCommentary = async () => {
    if (!generalCommentary.trim()) return;
    setIsDigestingGeneral(true);
    setDigestedFeedbackSuccess(null);
    try {
      const diffsSummary = currentReport?.loops?.[0]?.bulletpoints?.join('\n') || '';
      const res = await fetch('/api/developer/fgd-test/digest-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userComment: generalCommentary.trim(),
          garmentId: currentReport?.garment_id || 'GENERAL',
          diffsSummary
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.digestedRules) && data.digestedRules.length > 0) {
        setDigestedRules(prev => [...data.digestedRules, ...prev]);
        setDigestedFeedbackSuccess(`AI successfully digested your commentary into ${data.digestedRules.length} catalog labeling rule(s)! Review and approve below.`);
        setTimeout(() => setDigestedFeedbackSuccess(null), 6000);
      } else {
        alert("Could not extract rules from the commentary. Please add a bit more context.");
      }
    } catch (err) {
      console.error("Failed to digest commentary:", err);
      alert("Error contacting rule digestion engine.");
    } finally {
      setIsDigestingGeneral(false);
    }
  };

  const handleDigestSingleRule = async (rule: RuleAmendment) => {
    const edit = getRuleEditState(rule);
    const comment = edit.user_comment.trim();
    if (!comment) return;
    setDigestingSingleCode(rule.rule_code);
    try {
      const res = await fetch('/api/developer/fgd-test/digest-commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userComment: comment,
          garmentId: currentReport?.garment_id,
          existingRule: rule
        })
      });
      const data = await res.json();
      if (data.success && Array.isArray(data.digestedRules) && data.digestedRules.length > 0) {
        const refined = data.digestedRules[0];
        updateRuleEdit(rule.rule_code, {
          rule_title: refined.rule_title,
          rule_instruction: refined.rule_instruction,
          condition_trigger: refined.condition_trigger,
          target_field: refined.target_field,
          user_comment: comment
        });
      }
    } catch (err) {
      console.error("Failed to digest single rule comment:", err);
    } finally {
      setDigestingSingleCode(null);
    }
  };

  const generateMarkdownReport = (): string => {
    if (reports.length === 0) return '';
    let md = `# Winzen Full Garment Description (FGD) Test & Calibration Report\n`;
    md += `*Generated: ${new Date().toLocaleString()}*\n`;
    md += `*Total Evaluation Runtime: ${activeJob?.elapsedSeconds ? `${activeJob.elapsedSeconds}s` : `${elapsedSeconds}s`}*\n\n`;

    reports.forEach((rep, idx) => {
      md += `## Garment ${idx + 1}: ${rep.garment_id}\n`;
      md += `- **Final Score**: ${rep.final_score} / 10.0 (${rep.final_verdict})\n`;
      md += `- **Images Evaluated**: ${rep.images_processed.join(', ')}\n`;
      md += `- **Evaluation Loops**: ${rep.loops.length}\n\n`;

      rep.loops.forEach(loop => {
        md += `### Loop ${loop.loop_number} Results (Score: ${loop.score}/10)\n`;
        md += `- **Breakdown**: Label ${loop.score_breakdown.label_accuracy}/4.0 | Description ${loop.score_breakdown.description_fidelity}/4.0 | Hashtags ${loop.score_breakdown.hashtag_coverage}/2.0\n\n`;
        md += `#### Observed Discrepancies vs Baseline:\n`;
        if (loop.bulletpoints.length === 0) {
          md += `- No significant discrepancies detected.\n`;
        } else {
          loop.bulletpoints.forEach(bp => {
            md += `${bp}\n`;
          });
        }
        md += `\n#### Calibrated Labelling Rules / Patterns:\n`;
        if (loop.amended_rules.length === 0) {
          md += `- No new rules required.\n`;
        } else {
          loop.amended_rules.forEach(r => {
            const edit = getRuleEditState(r);
            md += `- **[${r.rule_code}] (${r.rule_type.toUpperCase()}) ${edit.rule_title || r.rule_title}**: ${edit.rule_instruction || r.rule_instruction}\n`;
            if (edit.user_comment) {
              md += `  *Merchandiser Note: ${edit.user_comment}*\n`;
            }
          });
        }
        md += `\n`;
      });
      md += `---\n\n`;
    });

    return md;
  };

  const handleCopyReport = () => {
    const text = generateMarkdownReport();
    navigator.clipboard.writeText(text);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  const filteredLogs = logs.filter(log => {
    if (logFilter === 'STEP') return log.level === 'STEP' || log.level === 'SUCCESS';
    if (logFilter === 'ERROR') return log.level === 'ERROR' || log.level === 'WARN';
    return true;
  });

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Control Banner & Timer Header */}
      <FgdControlHeader
        libraryGarments={libraryGarments}
        approvedGarments={approvedGarments}
        underReviewGarments={underReviewGarments}
        selectedGarmentId={selectedGarmentId}
        setSelectedGarmentId={setSelectedGarmentId}
        maxLoops={maxLoops}
        setMaxLoops={setMaxLoops}
        running={running}
        handleStartSuite={handleStartSuite}
        handleStopSuite={handleStopSuite}
        handleRerunUnderReview={handleRerunUnderReview}
        archivedRulesCount={dbRules.filter(r => r.is_active).length}
        onOpenArchivedRules={() => setShowArchivedModal(true)}
        pendingRulesCount={totalPendingRulesCount}
        onWipePendingRules={() => {
          setWipeScope('last_round');
          setShowWipeModal(true);
        }}
        isWipingRules={isWipingRules}
      />

      {/* Wipe Notification Banner */}
      {wipeNotification && (
        <div className="bg-rose-50/90 border border-rose-200 rounded-2xl p-4 flex items-center justify-between text-rose-950 text-sm shadow-xs animate-in fade-in">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 border border-rose-200">
              <Trash2 className="w-4 h-4" />
            </div>
            <div>
              <p className="font-bold text-rose-950">Pending Rules Wiped</p>
              <p className="text-xs text-rose-800">{wipeNotification.message}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setWipeNotification(null)}
            className="text-xs font-bold text-rose-700 hover:text-rose-950 px-3 py-1.5 rounded-lg hover:bg-rose-100 transition-colors cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Real-time Diagnostics HUD & Execution Timer */}
      <FgdExecutionHud
        running={running}
        activeJob={activeJob}
        elapsedSeconds={elapsedSeconds}
        formatTimer={formatTimer}
        reports={reports}
        logs={logs}
        showLogsPanel={showLogsPanel}
        setShowLogsPanel={setShowLogsPanel}
        logFilter={logFilter}
        setLogFilter={setLogFilter}
        copiedReport={copiedReport}
        handleCopyReport={handleCopyReport}
        logsEndRef={logsEndRef}
      />

      {/* Reports Section & Archive Explorer */}
      {reports.length > 0 && (
        <div className="space-y-6">
          {/* Archive Selector & Revisit Panel */}
          <FgdArchiveSelector
            reports={reports}
            selectedReportIndex={selectedReportIndex}
            setSelectedReportIndex={setSelectedReportIndex}
            onRefreshArchive={() => {
              fetch('/api/developer/fgd-test/reports')
                .then(res => res.json())
                .then(d => {
                  if (Array.isArray(d.reports)) {
                    setReports(d.reports);
                  }
                });
            }}
            copiedReport={copiedReport}
            onCopyReport={handleCopyReport}
          />

          {currentReport && (
            <div className="space-y-6">
              {/* Scorecard Hero & Sandbox Assurance */}
              <FgdScorecardHero currentReport={currentReport} />

              {/* Merchandiser Commentary & Natural Language Guidance (AI Auto-Digest) */}
              <FgdMerchandiserFeedback
                generalCommentary={generalCommentary}
                setGeneralCommentary={setGeneralCommentary}
                isDigestingGeneral={isDigestingGeneral}
                handleDigestGeneralCommentary={handleDigestGeneralCommentary}
                digestedFeedbackSuccess={digestedFeedbackSuccess}
                digestedRules={digestedRules}
                setDigestedRules={setDigestedRules}
                appliedRules={appliedRules}
                handleApplyRule={handleApplyRule}
              />

              {/* Loop Details */}
              {currentReport.loops.map((loop) => (
                <div key={loop.loop_number} className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
                  <div className="bg-neutral-50 px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-neutral-900 text-white font-bold text-xs flex items-center justify-center">
                        L{loop.loop_number}
                      </span>
                      <div>
                        <h3 className="text-base font-bold text-neutral-900">
                          Loop {loop.loop_number} Evaluation
                        </h3>
                        <p className="text-xs text-neutral-500">{loop.evaluation_summary}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-neutral-500">Loop Score:</span>
                      <span className="px-3 py-1 bg-white border border-neutral-200 rounded-lg text-sm font-black text-neutral-900">
                        {loop.score} / 10
                      </span>
                    </div>
                  </div>

                  <div className="p-6 space-y-6">
                    {/* Bulletpoints of Differences */}
                    <div>
                      <h4 className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-500" />
                        Discrepancies Observed Against Original FGD
                      </h4>
                      {loop.bulletpoints.length === 0 ? (
                        <div className="p-4 bg-emerald-50 text-emerald-800 text-sm rounded-xl flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Exact match with baseline FGD across all fields, descriptions, and hashtags!</span>
                        </div>
                      ) : (
                        <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-4 space-y-2">
                          {loop.bulletpoints.map((bp, bpIdx) => (
                            <div key={bpIdx} className="text-xs text-neutral-800 leading-relaxed font-mono">
                              {bp}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Unresolved Discrepancies Routed as Questions for Jennifer & Jason */}
                    {loop.review_questions && loop.review_questions.length > 0 && (
                      <div className="bg-amber-50/90 border border-amber-300/80 rounded-2xl p-5 space-y-4 shadow-xs">
                        <div className="flex items-center justify-between border-b border-amber-200/80 pb-3">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-amber-500 text-neutral-950 flex items-center justify-center font-black text-sm shadow-2xs">
                              ?
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-neutral-900 flex items-center gap-2">
                                <span>Routed to Review Record (Jennifer &amp; Jason)</span>
                                <span className="px-2 py-0.5 text-[11px] font-black rounded-full bg-amber-200 text-amber-900 border border-amber-300">
                                  {loop.review_questions.length} Decision Item(s)
                                </span>
                              </h4>
                              <p className="text-xs text-neutral-600">
                                Fast 1-Loop Evaluation: Candidate rule generation is disabled. Discrepancies are formulated as structured questions and persisted directly to the garment&apos;s review record.
                              </p>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-3">
                          {loop.review_questions.map((rq, rqIdx) => (
                            <div key={rqIdx} className="bg-white border border-amber-200 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                              <div className="flex items-center gap-2">
                                <span className="px-2 py-0.5 text-[10px] font-bold uppercase rounded bg-neutral-100 text-neutral-700 border border-neutral-200">
                                  {rq.field || rq.category}
                                </span>
                                <span className="text-xs text-neutral-500 font-medium italic">
                                  {rq.discrepancy}
                                </span>
                              </div>
                              <p className="text-xs font-semibold text-neutral-900 leading-relaxed">
                                {rq.question}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Calibrated Rule Amendments (Approved rules are archived to DB and hidden by default) */}
                    {loop.amended_rules.length > 0 && (() => {
                      const pendingRules = loop.amended_rules.filter(r => !isRuleApproved(r));
                      const archivedRules = loop.amended_rules.filter(r => isRuleApproved(r));
                      const isArchiveExpanded = !!expandedLoopArchives[loop.loop_number];

                      return (
                        <div className="space-y-4">
                          {/* When there are pending rules awaiting approval */}
                          {pendingRules.length > 0 && (
                            <div>
                              <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-xs font-bold text-neutral-600 uppercase tracking-wider flex items-center gap-1.5">
                                    <Sparkles className="w-4 h-4 text-indigo-500" />
                                    Pending Rule Amendments ({pendingRules.length})
                                  </h4>
                                  <span className="text-[11px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full border border-amber-200">
                                    Awaiting Approval
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setWipeScope('last_round');
                                      setShowWipeModal(true);
                                    }}
                                    disabled={isWipingRules}
                                    className="px-3 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-rose-200 shadow-2xs"
                                    title="Wipe out all unapproved pending rules generated in this evaluation round"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                    <span>Wipe Pending Rules</span>
                                  </button>
                                  {archivedRules.length > 0 && (
                                    <button
                                      type="button"
                                      onClick={() => setExpandedLoopArchives(prev => ({ ...prev, [loop.loop_number]: !prev[loop.loop_number] }))}
                                      className="px-3 py-1 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer border border-neutral-200"
                                    >
                                      <Archive className="w-3.5 h-3.5 text-emerald-600" />
                                      <span>{isArchiveExpanded ? 'Hide Archived' : `Review Archived Rules (${archivedRules.length})`}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              <div className="grid grid-cols-1 gap-4">
                                {pendingRules.map((rule, rIdx) => {
                                  const isApplied = false;
                                  const edit = getRuleEditState(rule);
                                  const isHugoBoss = (rule.target_field === 'buyer' || /hugo|boss/i.test(rule.rule_title) || /hugo|boss/i.test(rule.rule_instruction)) && (currentReport.original_fgd.label.buyer?.toLowerCase().includes('hugo') || /hugo|boss/i.test(rule.rule_title));
                                  const thread = ruleThreads[rule.rule_code] || { isOpen: false, feedback: '', isThinking: false, messages: [] };
                                  const isApproving = approvingCode === rule.rule_code;
                                  const outcomeMsg = approvalOutcomeMessage[rule.rule_code];

                                  return (
                                    <FgdRuleAmendmentsCard
                                      key={rule.rule_code || rIdx}
                                      rule={rule}
                                      edit={edit}
                                      isApplied={isApplied}
                                      isApproving={isApproving}
                                      outcomeMsg={outcomeMsg}
                                      thread={thread}
                                      isHugoBoss={isHugoBoss}
                                      toggleRuleThread={toggleRuleThread}
                                      handleApproveAiDeduction={handleApproveAiDeduction}
                                      handleRerunUnderReview={handleRerunUnderReview}
                                      running={running}
                                      underReviewGarmentsCount={underReviewGarments.length}
                                      updateRuleFeedback={updateRuleFeedback}
                                      handleSendRecorrection={handleSendRecorrection}
                                    />
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* When all rules in this loop have been approved and archived */}
                          {pendingRules.length === 0 && archivedRules.length > 0 && (
                            <div className="bg-emerald-50/80 border border-emerald-200/90 rounded-2xl p-4.5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-2xs">
                              <div className="flex items-center gap-3">
                                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
                                  <ShieldCheck className="w-5 h-5" />
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h5 className="text-xs font-bold text-emerald-950">
                                      All Calibrated Rules Approved & Archived
                                    </h5>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                                      {archivedRules.length} Active in Rules DB
                                    </span>
                                  </div>
                                  <p className="text-xs text-emerald-850 mt-0.5">
                                    All suggested rule amendments have been approved, archived, and persisted to the database.
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => setExpandedLoopArchives(prev => ({ ...prev, [loop.loop_number]: !prev[loop.loop_number] }))}
                                className="px-3.5 py-2 bg-white hover:bg-neutral-50 text-neutral-800 border border-neutral-300 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-2xs shrink-0"
                              >
                                <Archive className="w-3.5 h-3.5 text-emerald-600" />
                                <span>{isArchiveExpanded ? 'Hide Archived Rules' : `Call Back Out for Review (${archivedRules.length})`}</span>
                              </button>
                            </div>
                          )}

                          {/* Expanded Archived Rules Panel for this loop */}
                          {isArchiveExpanded && archivedRules.length > 0 && (
                            <div className="bg-neutral-50/90 border border-neutral-200 rounded-2xl p-4 space-y-3 animate-in fade-in duration-200">
                              <div className="flex items-center justify-between border-b border-neutral-200 pb-2">
                                <div className="flex items-center gap-2">
                                  <Archive className="w-4 h-4 text-emerald-600" />
                                  <span className="text-xs font-bold text-neutral-800">
                                    Archived Rules Called Out for Review ({archivedRules.length})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => setExpandedLoopArchives(prev => ({ ...prev, [loop.loop_number]: false }))}
                                  className="text-xs text-neutral-500 hover:text-neutral-800 font-medium cursor-pointer"
                                >
                                  Close
                                </button>
                              </div>

                              <div className="grid grid-cols-1 gap-4">
                                {archivedRules.map((rule, rIdx) => {
                                  const edit = getRuleEditState(rule);
                                  const isHugoBoss = (rule.target_field === 'buyer' || /hugo|boss/i.test(rule.rule_title) || /hugo|boss/i.test(rule.rule_instruction)) && (currentReport.original_fgd.label.buyer?.toLowerCase().includes('hugo') || /hugo|boss/i.test(rule.rule_title));
                                  const thread = ruleThreads[rule.rule_code] || { isOpen: false, feedback: '', isThinking: false, messages: [] };
                                  const isApproving = approvingCode === rule.rule_code;
                                  const outcomeMsg = approvalOutcomeMessage[rule.rule_code];

                                  return (
                                    <div key={rule.rule_code || rIdx} className="space-y-2">
                                      <div className="flex items-center justify-between px-1">
                                        <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                                          <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                          <span>Archived & Active in Rules DB</span>
                                        </span>
                                        <button
                                          type="button"
                                          onClick={() => handleRecallRule(rule.rule_code)}
                                          disabled={isRecallingCode === rule.rule_code}
                                          className="text-xs text-neutral-600 hover:text-neutral-900 bg-white border border-neutral-300 hover:bg-neutral-100 px-2.5 py-1 rounded-lg font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                          title="Recall this rule from archive back to pending review"
                                        >
                                          <RotateCcw className="w-3 h-3 text-neutral-500" />
                                          <span>Recall for Re-review</span>
                                        </button>
                                      </div>
                                      <FgdRuleAmendmentsCard
                                        rule={rule}
                                        edit={edit}
                                        isApplied={true}
                                        isApproving={isApproving}
                                        outcomeMsg={outcomeMsg}
                                        thread={thread}
                                        isHugoBoss={isHugoBoss}
                                        toggleRuleThread={toggleRuleThread}
                                        handleApproveAiDeduction={handleApproveAiDeduction}
                                        handleRerunUnderReview={handleRerunUnderReview}
                                        running={running}
                                        underReviewGarmentsCount={underReviewGarments.length}
                                        updateRuleFeedback={updateRuleFeedback}
                                        handleSendRecorrection={handleSendRecorrection}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Side-by-Side Comparison: Baseline vs Fresh FGD */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-2">
                      {/* Original Baseline FGD */}
                      <div className="border border-neutral-200 rounded-xl p-5 space-y-4 bg-white">
                        <div className="flex items-center justify-between border-b border-neutral-100 pb-2">
                          <span className="text-xs font-bold text-neutral-500 uppercase tracking-wider">
                            Original Baseline FGD
                          </span>
                          <span className="text-[11px] font-semibold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                            Stored DB Record
                          </span>
                        </div>

                        {/* Label Data Table */}
                        <div>
                          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">1. Label Spec Sheet</div>
                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-3 py-1 border-b border-neutral-50">
                              <span className="text-neutral-500 font-medium">Buyer:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{currentReport.original_fgd.label.buyer || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-neutral-50">
                              <span className="text-neutral-500 font-medium">Garment Type:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{currentReport.original_fgd.label.garment_type || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-neutral-50">
                              <span className="text-neutral-500 font-medium">Fabric Material:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{currentReport.original_fgd.label.fabric_material || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-neutral-50">
                              <span className="text-neutral-500 font-medium">Knit Structure:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{currentReport.original_fgd.label.fabric_construction || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-neutral-50">
                              <span className="text-neutral-500 font-medium">Style Numbers:</span>
                              <span className="col-span-2 font-bold text-neutral-900">
                                {currentReport.original_fgd.label.y_style_no || '-'} / {currentReport.original_fgd.label.cust_style_no || '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Garment Description */}
                        <div>
                          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">2. Garment Description</div>
                          <div className="p-3 bg-neutral-50 rounded-lg text-xs text-neutral-800 leading-relaxed italic border border-neutral-100">
                            "{currentReport.original_fgd.garment_description || 'No original description'}"
                          </div>
                        </div>

                        {/* Hashtags */}
                        <div>
                          <div className="text-xs font-bold text-neutral-400 uppercase tracking-wider mb-2">3. Hashtags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {currentReport.original_fgd.hashtags.map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-neutral-100 text-neutral-700 text-[11px] font-semibold rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>

                      {/* Fresh Image-Generated FGD */}
                      <div className="border border-indigo-200 bg-indigo-50/20 rounded-xl p-5 space-y-4">
                        <div className="flex items-center justify-between border-b border-indigo-100 pb-2">
                          <span className="text-xs font-bold text-indigo-700 uppercase tracking-wider">
                            Freshly Generated FGD (Loop {loop.loop_number})
                          </span>
                          <span className="text-[11px] font-semibold bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded">
                            Direct Image Inspection (Zero Text Reference)
                          </span>
                        </div>

                        {/* Label Data Table */}
                        <div>
                          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">1. Fresh Label Spec Sheet</div>
                          <div className="space-y-1.5 text-xs">
                            <div className="grid grid-cols-3 py-1 border-b border-indigo-50">
                              <span className="text-neutral-500 font-medium">Buyer:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{loop.fresh_fgd.label.buyer || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-indigo-50">
                              <span className="text-neutral-500 font-medium">Garment Type:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{loop.fresh_fgd.label.garment_type || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-indigo-50">
                              <span className="text-neutral-500 font-medium">Fabric Material:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{loop.fresh_fgd.label.fabric_material || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-indigo-50">
                              <span className="text-neutral-500 font-medium">Knit Structure:</span>
                              <span className="col-span-2 font-bold text-neutral-900">{loop.fresh_fgd.label.fabric_construction || '-'}</span>
                            </div>
                            <div className="grid grid-cols-3 py-1 border-b border-indigo-50">
                              <span className="text-neutral-500 font-medium">Style Numbers:</span>
                              <span className="col-span-2 font-bold text-neutral-900">
                                {loop.fresh_fgd.label.y_style_no || '-'} / {loop.fresh_fgd.label.cust_style_no || '-'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Garment Description */}
                        <div>
                          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">2. Fresh Garment Description</div>
                          <div className="p-3 bg-white rounded-lg text-xs text-neutral-800 leading-relaxed italic border border-indigo-100">
                            "{loop.fresh_fgd.garment_description || 'No description generated'}"
                          </div>
                        </div>

                        {/* Hashtags */}
                        <div>
                          <div className="text-xs font-bold text-indigo-400 uppercase tracking-wider mb-2">3. Fresh Hashtags</div>
                          <div className="flex flex-wrap gap-1.5">
                            {loop.fresh_fgd.hashtags.map((t, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-indigo-100/80 text-indigo-800 text-[11px] font-semibold rounded">
                                {t}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Zero State / Instructions */}
      {!running && reports.length === 0 && (
        <div className="bg-white p-12 rounded-2xl border border-neutral-200 text-center space-y-4">
          <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mx-auto">
            <Layers className="w-7 h-7" />
          </div>
          <div className="max-w-md mx-auto space-y-2">
            <h3 className="text-lg font-bold text-neutral-900">Ready to Evaluate Library Garments</h3>
            <p className="text-sm text-neutral-500">
              Select a garment or run the full 2-garment library suite. The background thread engine runs autonomously with live timing, bite-sized OCR/visual chunking, discrepancy analysis, and interactive rule calibration.
            </p>
          </div>
          <button
            onClick={handleStartSuite}
            disabled={libraryGarments.length === 0}
            className="px-6 py-2.5 bg-neutral-900 hover:bg-black text-white text-sm font-bold rounded-xl inline-flex items-center gap-2 shadow-sm transition-all cursor-pointer"
          >
            <Play className="w-4 h-4 fill-current text-emerald-400" />
            <span>Start Test Suite</span>
          </button>
        </div>
      )}

      {/* Archived Rules & Calibrated Deductions Modal */}
      <FgdArchivedRulesModal
        isOpen={showArchivedModal}
        onClose={() => setShowArchivedModal(false)}
        rules={dbRules}
        onRecallRule={handleRecallRule}
        onReapplyRule={handleReapplyRule}
        isRecallingCode={isRecallingCode}
      />

      {/* Wipe Pending Rules Modal */}
      <FgdWipePendingModal
        isOpen={showWipeModal}
        onClose={() => setShowWipeModal(false)}
        onConfirmWipe={handleConfirmWipe}
        isWiping={isWipingRules}
        pendingCount={totalPendingRulesCount}
        currentGarmentId={currentReport?.garment_id}
        scope={wipeScope}
        setScope={setWipeScope}
      />
    </div>
  );
}
