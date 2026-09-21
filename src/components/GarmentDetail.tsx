import React, { useState, useMemo, useEffect } from 'react';
import { 
  ArrowLeft, AlertTriangle, Barcode as BarcodeIcon, MessageSquare, Star, 
  Hash, Search, Plus, X, ZoomIn, Camera, CheckCircle, RefreshCw, ArrowRight, ShieldCheck,
  Trash2, Edit3, Lock, Tag, Check, Layers, MapPin, Zap, Brain, Scale, CheckCircle2, AlertCircle, Sparkles, Send, RotateCcw,
  Columns
} from 'lucide-react';
import Barcode from 'react-barcode';
import { ImageViewerModal } from './ImageViewerModal';
import { PendingChangesModal } from './PendingChangesModal';
import { SpaceAssignmentBox } from '../warehouse-ui';
import { SideBySideInspector } from './SideBySideInspector';

interface GarmentDetailProps {
  garment: any;
  onClose: () => void;
  onUpdated?: () => void;
}

export function GarmentDetail({ garment, onClose, onUpdated }: GarmentDetailProps) {
  const [showBarcode, setShowBarcode] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  // Active images list for the garment
  const [activeImages, setActiveImages] = useState<any[]>(garment.images || []);

  useEffect(() => {
    setActiveImages(garment.images || []);
  }, [garment.images]);

  // Display all images: canonical Front, Back, Label first, then any Review / Alternative shots
  const displayImages = useMemo(() => {
    if (!activeImages || !Array.isArray(activeImages)) return [];
    const roleOrder: Record<string, number> = { 'Front': 1, 'Back': 2, 'Label': 3 };
    return [...activeImages].sort((a: any, b: any) => {
      const aOrder = a.isReview ? 50 : (roleOrder[a.role] || 10);
      const bOrder = b.isReview ? 50 : (roleOrder[b.role] || 10);
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (Number(a.id) || 0) - (Number(b.id) || 0);
    });
  }, [activeImages]);

  const currentImgObj = displayImages[selectedImageIndex] || displayImages[0] || null;

  // 3-Tier Routing: Serve sharp AI tier (images_ai/) for OCR, detail inspection, and label analysis
  const getImageSource = (img: any) => {
    if (!img) return '';
    return img.aiUrl || img.fullUrl || (img.filename ? `/images_ai/${img.filename}` : null) || img.url || img.fallbackUrl;
  };

  // Side-by-Side Inspection & Re-run FGD State
  const [sideBySideMode, setSideBySideMode] = useState(false);
  const [rerunningFgd, setRerunningFgd] = useState(false);

  // Re-run single garment FGD extraction in-place
  const handleRerunFgd = async () => {
    if (rerunningFgd) return;
    setRerunningFgd(true);
    setStatusNotification(null);
    try {
      const res = await fetch('/api/fgd/run-single-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ garmentId: garment.id, updateGarment: true })
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to re-run FGD extraction');
      }

      if (data.freshFgd?.label) {
        const label = data.freshFgd.label;
        setEditData((prev: any) => ({
          ...prev,
          buyer: label.buyer || prev.buyer,
          brand_code: label.brand_code || prev.brand_code,
          season: label.season || prev.season,
          sales: label.sales || prev.sales,
          merchandiser: label.merchandiser || prev.merchandiser,
          cust_style_no: label.cust_style_no || prev.cust_style_no,
          y_style_no: label.y_style_no || prev.y_style_no,
          goods_no: label.goods_no || prev.goods_no,
          sample_job_no: label.sample_job_no || prev.sample_job_no,
          sample_stage: label.sample_stage || prev.sample_stage,
          garment_type: label.garment_type || prev.garment_type,
          washing: label.washing || prev.washing,
          fabric_raw: label.fabric_raw || prev.fabric_raw,
          fabric_material: label.fabric_material || prev.fabric_material,
          fabric_yarn_count: label.fabric_yarn_count || prev.fabric_yarn_count,
          fabric_construction: label.fabric_construction || prev.fabric_construction,
          color: label.color || prev.color,
          size: label.size || prev.size,
          gnw_weight: label.gnw_weight || prev.gnw_weight,
          remark_memo: label.remark_memo || prev.remark_memo,
          handwritten_notes: label.handwritten_notes || prev.handwritten_notes,
          description: data.freshFgd.garment_description || prev.description,
          hashtags: Array.isArray(data.freshFgd.hashtags) && data.freshFgd.hashtags.length > 0 
            ? data.freshFgd.hashtags.join(', ') 
            : prev.hashtags
        }));
      } else if (data.garment) {
        setEditData((prev: any) => ({
          ...prev,
          ...data.garment
        }));
      }

      setStatusNotification({
        type: 'success',
        message: `FGD re-extracted successfully for ${garment.id}! Captured zero-omission specs from physical label.`
      });

      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error("Re-run FGD error:", err);
      setStatusNotification({
        type: 'error',
        message: err.message || 'Failed to re-run FGD extraction'
      });
    } finally {
      setRerunningFgd(false);
    }
  };

  // Duplicate / Different Shot Resolution State
  const [renameBubbleOpen, setRenameBubbleOpen] = useState(false);
  const [renameTargetImg, setRenameTargetImg] = useState<any>(null);
  const [renameSuffix, setRenameSuffix] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteTargetImg, setDeleteTargetImg] = useState<any>(null);
  const [imageActionLoading, setImageActionLoading] = useState(false);
  
  // Lightbox Modal State
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState({ url: '', title: '', subtitle: '' });

  // Pending Changes Modal State
  const [pendingModalOpen, setPendingModalOpen] = useState(false);

  // Content Edit State
  const [editData, setEditData] = useState({
    ...garment,
    structural_feedback: garment.structural_feedback || garment.reviewer_feedback || '',
    content_notes: garment.content_notes || '',
    hashtags: garment.hashtags || '',
    invisible_hashtags: garment.invisible_hashtags || ''
  });

  const [saving, setSaving] = useState(false);
  const [activating, setActivating] = useState(false);
  const [activationSyntax, setActivationSyntax] = useState('');
  const [statusNotification, setStatusNotification] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [assignSpaceOpen, setAssignSpaceOpen] = useState(false);

  // Director Jason Commentary & Dual Flash/Pro Review State
  const [directorComment, setDirectorComment] = useState<string>(
    garment.director_comment || garment.director_comment_record?.comment || ''
  );
  const [savingDirectorComment, setSavingDirectorComment] = useState(false);
  const [commentSaveSuccess, setCommentSaveSuccess] = useState(false);
  const [flashVerifying, setFlashVerifying] = useState(false);
  const [flashEvaluation, setFlashEvaluation] = useState<any>(
    garment.director_comment_record?.flash_evaluation || null
  );
  const [proArbitrating, setProArbitrating] = useState(false);
  const [proArbitration, setProArbitration] = useState<any>(
    garment.director_comment_record?.pro_arbitration || null
  );
  const [approvingToLibrary, setApprovingToLibrary] = useState(false);
  const [proposedRuleStaged, setProposedRuleStaged] = useState(false);
  
  // Draft Proposed Changes Preview State (Digested comments without approving)
  const [digestingDraft, setDigestingDraft] = useState(false);
  const [draftPreview, setDraftPreview] = useState<any>(
    garment.director_comment_record?.draft_preview || null
  );
  const [originalBeforePreview, setOriginalBeforePreview] = useState<any>(null);

  // Hydrate latest Director Commentary and Evaluations from durable API
  useEffect(() => {
    if (!garment?.id) return;
    fetch(`/api/garments/${encodeURIComponent(garment.id)}/director-comment?_t=${Date.now()}`)
      .then(res => res.json())
      .then(data => {
        if (data?.record) {
          if (data.record.comment && !directorComment) {
            setDirectorComment(data.record.comment);
          }
          if (data.record.flash_evaluation) {
            setFlashEvaluation(data.record.flash_evaluation);
          }
          if (data.record.pro_arbitration) {
            setProArbitration(data.record.pro_arbitration);
          }
          if (data.record.draft_preview && !draftPreview) {
            setDraftPreview(data.record.draft_preview);
          }
        }
      })
      .catch(() => {});
  }, [garment.id]);

  // Garment ID Rename & Equate State (Supports Temporary / Sticker -> Official style number migration)
  const [renameGarmentModalOpen, setRenameGarmentModalOpen] = useState(false);
  const [newGarmentIdInput, setNewGarmentIdInput] = useState('');
  const [equateNotesInput, setEquateNotesInput] = useState('');
  const [renameGarmentLoading, setRenameGarmentLoading] = useState(false);

  const isStickerCode = /^WZ[-_]/i.test(garment.id);
  const isTemporaryGarment = /^(TEMP|UNTAGGED|CAPTURE-TEMP|WZ)[-_]/i.test(garment.id) || !!garment.previous_generated_code;
  const suggestedStyleNo = (editData.y_style_no || editData.cust_style_no || '').trim();

  const handleRenameGarment = async (targetId: string) => {
    if (!targetId.trim()) return;
    setRenameGarmentLoading(true);
    try {
      // Use equate endpoint for sticker or temporary codes to retain audit mapping
      const isEquateAction = isStickerCode || /^(TEMP|UNTAGGED)/i.test(garment.id);
      const url = isEquateAction 
        ? `/api/garments/${encodeURIComponent(garment.id)}/equate-code`
        : `/api/garments/${encodeURIComponent(garment.id)}/rename-garment`;
      
      const payload = isEquateAction ? {
        correctedCode: targetId.trim(),
        equatedBy: 'Jennifer',
        referenceNotes: equateNotesInput.trim() || 'Found original garment code'
      } : {
        newGarmentId: targetId.trim(),
        reason: "Renamed by merchandiser in Garment Detail"
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to rename / equate garment");
      }
      setStatusNotification({
        type: 'success',
        message: `Garment successfully ${isEquateAction ? 'equated to' : 'renamed to'} ${data.newGarmentId || targetId}! All image files and catalog records updated.`
      });
      setRenameGarmentModalOpen(false);
      onUpdated?.();
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error("Rename garment error:", err);
      setStatusNotification({ type: 'error', message: err.message || "Failed to rename garment" });
    } finally {
      setRenameGarmentLoading(false);
    }
  };

  // Summary State
  const [summariesList, setSummariesList] = useState<any[]>(garment.summaries || []);
  const currentSummary = summariesList[0] || null;
  const [rating, setRating] = useState(currentSummary?.rating || 5);
  
  // Language Toggle State
  const [lang, setLang] = useState<'en' | 'zh'>('en');

  // New tag inputs
  const [newVisibleTag, setNewVisibleTag] = useState('');
  const [newInvisibleTag, setNewInvisibleTag] = useState('');

  // Parse hashtags into clean arrays
  const parseTags = (str: string) => {
    if (!str) return [];
    return str
      .split(',')
      .map(t => t.trim())
      .filter(Boolean)
      .map(t => t.startsWith('#') ? t : `#${t}`);
  };

  const visibleTagsList = parseTags(editData.hashtags || '');
  const invisibleTagsList = parseTags(editData.invisible_hashtags || '');

  const addVisibleTag = (tag: string) => {
    const cleaned = tag.trim().replace(/^#+/, '').trim();
    if (!cleaned) return;
    const formatted = `#${cleaned}`;
    if (!visibleTagsList.includes(formatted)) {
      const updated = [...visibleTagsList, formatted].join(', ');
      setEditData((prev: any) => ({ ...prev, hashtags: updated }));
    }
    setNewVisibleTag('');
  };

  const removeVisibleTag = (tagToRemove: string) => {
    const updated = visibleTagsList.filter(t => t !== tagToRemove).join(', ');
    setEditData((prev: any) => ({ ...prev, hashtags: updated }));
  };

  const addInvisibleTag = (tag: string) => {
    const cleaned = tag.trim().replace(/^#+/, '').trim();
    if (!cleaned) return;
    const formatted = `#${cleaned}`;
    if (!invisibleTagsList.includes(formatted)) {
      const updated = [...invisibleTagsList, formatted].join(', ');
      setEditData((prev: any) => ({ ...prev, invisible_hashtags: updated }));
    }
    setNewInvisibleTag('');
  };

  const removeInvisibleTag = (tagToRemove: string) => {
    const updated = invisibleTagsList.filter(t => t !== tagToRemove).join(', ');
    setEditData((prev: any) => ({ ...prev, invisible_hashtags: updated }));
  };

  const handleFieldChange = (key: string, val: string) => {
    setEditData((prev: any) => ({ ...prev, [key]: val }));
  };

  const getLabel = (en: string, zh?: string) => {
    if (lang === 'zh' && zh) return zh;
    return en;
  };

  // Open Full-Res Lightbox on Double Click
  const handleOpenLightbox = (imgUrl: string, role = 'Front') => {
    // Prefer highest resolution raw or AI image
    setLightboxData({
      url: imgUrl,
      title: `${garment.id} — ${role} View`,
      subtitle: `Full Resolution Image Archive (Double-Click Activated)`
    });
    setLightboxOpen(true);
  };

  // Image Management Handlers (Outcome 1.1 & 1.2 User Directives)
  const handleOpenRenameBubble = (img: any) => {
    if (!img) return;
    setRenameTargetImg(img);
    // Suggest an initial suffix
    let initialSuffix = '';
    const roleStr = img.role || '';
    if (roleStr.startsWith('Front')) {
      initialSuffix = '(F) Detail';
    } else if (roleStr.startsWith('Back')) {
      initialSuffix = '(B) Detail';
    } else if (roleStr.startsWith('Label')) {
      initialSuffix = 'Care Tag';
    } else {
      initialSuffix = roleStr.replace(/Review\s*\d*/i, '').trim() || 'Detail Shot';
    }
    setRenameSuffix(initialSuffix);
    setRenameBubbleOpen(true);
    setDeleteConfirmOpen(false);
  };

  const handleOpenDeleteConfirm = (img: any) => {
    if (!img) return;
    setDeleteTargetImg(img);
    setDeleteConfirmOpen(true);
    setRenameBubbleOpen(false);
  };

  const handleConfirmDelete = async () => {
    if (!deleteTargetImg) return;
    setImageActionLoading(true);
    try {
      const imgId = deleteTargetImg.id;
      const res = await fetch(`/api/garments/${garment.id}/images/${encodeURIComponent(imgId)}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to delete photo');
      }

      // Remove from local list
      setActiveImages(prev => prev.filter(img => img.id !== deleteTargetImg.id && img.filename !== deleteTargetImg.filename));
      setSelectedImageIndex(0);
      setDeleteConfirmOpen(false);
      setDeleteTargetImg(null);
      setStatusNotification({ 
        type: 'success', 
        message: `Photo ${deleteTargetImg.filename || deleteTargetImg.role} deleted successfully.` 
      });
      setTimeout(() => setStatusNotification(null), 4000);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error("Delete error:", err);
      setStatusNotification({ type: 'error', message: err.message || 'Failed to delete photo.' });
    } finally {
      setImageActionLoading(false);
    }
  };

  const handleConfirmRename = async () => {
    if (!renameTargetImg || !renameSuffix.trim()) return;
    setImageActionLoading(true);
    try {
      const imgId = renameTargetImg.id;
      const res = await fetch(`/api/garments/${garment.id}/images/${encodeURIComponent(imgId)}/rename`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ suffix: renameSuffix.trim() })
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to rename photo');
      }

      const updated = data.image;
      setActiveImages(prev => prev.map(img => (img.id === renameTargetImg.id ? { ...img, ...updated, isReview: false } : img)));
      setRenameBubbleOpen(false);
      setRenameTargetImg(null);
      setStatusNotification({ 
        type: 'success', 
        message: `Photo renamed to ${updated.filename} and kept successfully.` 
      });
      setTimeout(() => setStatusNotification(null), 4000);
      if (onUpdated) onUpdated();
    } catch (err: any) {
      console.error("Rename error:", err);
      setStatusNotification({ type: 'error', message: err.message || 'Failed to rename photo.' });
    } finally {
      setImageActionLoading(false);
    }
  };

  // 1. Stage into Pending Changes Queue
  const stageIntoPending = async () => {
    setSaving(true);
    setStatusNotification(null);
    try {
      const res = await fetch('/api/pending-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garment_id: garment.id,
          raw_feedback: editData.structural_feedback || 'User submitted field & hashtag updates',
          field_changes: {
            buyer: editData.buyer,
            garment_type: editData.garment_type,
            season: editData.season,
            sales: editData.sales,
            cust_style_no: editData.cust_style_no,
            y_style_no: editData.y_style_no,
            washing: editData.washing,
            fabric_raw: editData.fabric_raw,
            gnw_weight: editData.gnw_weight,
            fabric_yarn_count: editData.fabric_yarn_count,
            fabric_material: editData.fabric_material,
            fabric_construction: editData.fabric_construction,
            sample_job_no: editData.sample_job_no,
            color: editData.color,
            size: editData.size,
            print_datetime: editData.print_datetime,
            description: editData.description,
            remark_memo: editData.remark_memo,
            content_notes: editData.content_notes,
            hashtags: editData.hashtags,
            invisible_hashtags: editData.invisible_hashtags
          }
        })
      });
      if (res.ok) {
        setStatusNotification({
          type: 'success',
          message: 'Changes queued into Pending Approval list! Ready for activation via "Apply Approved Changes".'
        });
      }
    } catch (err) {
      setStatusNotification({ type: 'error', message: 'Failed to stage pending changes.' });
    } finally {
      setSaving(false);
    }
  };

  // 2. Direct Activation using exact syntax "Apply Approved Changes"
  const activateApprovedChanges = async () => {
    const isSyntaxCorrect = activationSyntax.trim().toLowerCase() === 'apply approved changes';
    if (!isSyntaxCorrect) {
      setStatusNotification({
        type: 'error',
        message: 'Syntax error: You must type exact command "Apply Approved Changes"'
      });
      return;
    }

    setActivating(true);
    setStatusNotification(null);
    try {
      // First ensure pending record exists
      await fetch('/api/pending-changes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          garment_id: garment.id,
          raw_feedback: editData.structural_feedback || 'Approved changes application',
          field_changes: editData
        })
      });

      // Now apply with exact syntax
      const res = await fetch('/api/changes/apply-approved', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          command: 'Apply Approved Changes',
          garment_id: garment.id
        })
      });
      const data = await res.json();

      if (res.ok) {
        setStatusNotification({
          type: 'success',
          message: 'Approved changes applied! Archival Summary regenerated with latest rules & hashtags updated.'
        });
        setActivationSyntax('');

        // Refresh garment summaries
        const gRes = await fetch('/api/garments');
        const gList = await gRes.json();
        const updated = gList.find((g: any) => g.id === garment.id);
        if (updated) {
          setSummariesList(updated.summaries || []);
          setEditData((prev: any) => ({
            ...prev,
            ...updated,
            hashtags: updated.hashtags || prev.hashtags,
            invisible_hashtags: updated.invisible_hashtags || prev.invisible_hashtags
          }));
        }
        if (onUpdated) onUpdated();
      } else {
        setStatusNotification({ type: 'error', message: data.error || 'Activation failed.' });
      }
    } catch (err: any) {
      setStatusNotification({ type: 'error', message: err.message || 'Error applying changes.' });
    } finally {
      setActivating(false);
    }
  };

  // --- DIRECTOR JASON COMMENTARY & DUAL FLASH/PRO REVIEW HANDLERS ---
  const handleSaveDirectorComment = async () => {
    if (!directorComment.trim()) return;
    setSavingDirectorComment(true);
    setCommentSaveSuccess(false);
    try {
      const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/director-comment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: directorComment, author: 'Director Jason' })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to save director comment');
      setCommentSaveSuccess(true);
      setTimeout(() => setCommentSaveSuccess(false), 3500);
      setStatusNotification({
        type: 'success',
        message: 'Director Commentary draft saved to durable storage. Garment remains in review queue.'
      });
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Failed to save comment' });
    } finally {
      setSavingDirectorComment(false);
    }
  };

  const handleRerunGarmentFgdFlash = async () => {
    if (!directorComment.trim()) {
      setStatusNotification({
        type: 'error',
        message: 'Please write Director observations or field notes before triggering Flash verification.'
      });
      return;
    }
    setFlashVerifying(true);
    try {
      const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/rerun-fgd-flash`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: directorComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Flash verification failed');
      setFlashEvaluation(data.evaluation);
      setStatusNotification({
        type: 'success',
        message: data.evaluation?.cleared 
          ? 'FLASH Model verified: Discrepancy CLEARED! Ready for Senior Merchandiser approval.' 
          : 'FLASH Model completed check: Remaining discrepancies identified below.'
      });
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Flash verification failed' });
    } finally {
      setFlashVerifying(false);
    }
  };

  const handleRunProArbitration = async () => {
    if (!directorComment.trim()) {
      setStatusNotification({
        type: 'error',
        message: 'Please enter commentary notes or discrepancy context before running Pro arbitration.'
      });
      return;
    }
    setProArbitrating(true);
    try {
      const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/arbitrate-discrepancy-pro`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: directorComment })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Pro arbitration failed');
      setProArbitration(data.arbitration);
      setStatusNotification({
        type: 'success',
        message: 'PRO Model (gemini-3.1-pro-preview) completed deep discrepancy arbitration and proposed catalog rule.'
      });
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Pro arbitration failed' });
    } finally {
      setProArbitrating(false);
    }
  };

  // --- DRAFT DIGESTION & SANDBOX PREVIEW (PREVIEW ONLY - NO APPROVAL) ---
  const handleDigestFeedbackPreview = async () => {
    if (!directorComment.trim()) {
      setStatusNotification({
        type: 'error',
        message: 'Please enter Director commentary notes before requesting feedback digestion.'
      });
      return;
    }
    setDigestingDraft(true);
    try {
      const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/digest-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ comment: directorComment, previewOnly: true })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to digest feedback');
      
      const preview = data.draftPreview;
      setDraftPreview(preview);
      
      // Save original snapshot before applying preview modifications if not already saved
      if (!originalBeforePreview) {
        setOriginalBeforePreview({ ...editData });
      }

      // Merge proposed field changes directly into editData for instant visual preview
      if (preview.proposed_field_changes && Object.keys(preview.proposed_field_changes).length > 0) {
        setEditData((prev: any) => ({
          ...prev,
          ...preview.proposed_field_changes
        }));
      }

      setStatusNotification({
        type: 'success',
        message: `Director commentary digested! ${preview.affected_fields?.length || 0} fields updated in Draft Preview. Garment is NOT approved and remains under review.`
      });
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Failed to digest feedback' });
    } finally {
      setDigestingDraft(false);
    }
  };

  const handleDiscardDraftPreview = () => {
    if (originalBeforePreview) {
      setEditData({ ...originalBeforePreview });
    }
    setDraftPreview(null);
    setOriginalBeforePreview(null);
    setStatusNotification({
      type: 'success',
      message: 'Draft preview discarded. Restored original garment fields.'
    });
  };

  const handleApplyProposedFields = (fields: Record<string, string>) => {
    if (!fields || Object.keys(fields).length === 0) return;
    setEditData((prev: any) => ({
      ...prev,
      ...fields
    }));
    setStatusNotification({
      type: 'success',
      message: `Adopted ${Object.keys(fields).length} verified field corrections into editor!`
    });
  };

  const handleStageProposedRule = async (rule: any) => {
    if (!rule) return;
    try {
      const res = await fetch('/api/fgd/rules/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rule_code: rule.rule_code,
          rule_title: rule.rule_title,
          condition_trigger: rule.condition_trigger,
          rule_instruction: rule.rule_instruction,
          target_field: rule.target_field,
          positive_example: rule.positive_example || '',
          negative_example: rule.negative_example || '',
          source_observation_code: garment.id
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to stage rule');
      setProposedRuleStaged(true);
      setStatusNotification({
        type: 'success',
        message: `Proposed rule ${rule.rule_code} successfully staged into Catalog Rules for review!`
      });
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Failed to stage rule' });
    }
  };

  const handleApproveAndMoveToLibrary = async () => {
    setApprovingToLibrary(true);
    try {
      const res = await fetch(`/api/garments/${encodeURIComponent(garment.id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to approve garment');
      setEditData((prev: any) => ({ ...prev, status: 'Approved' }));
      setStatusNotification({
        type: 'success',
        message: `Garment ${garment.id} successfully approved and moved to active Library by Senior Merchandiser Jennifer!`
      });
      if (onUpdated) onUpdated();
    } catch (e: any) {
      setStatusNotification({ type: 'error', message: e.message || 'Failed to approve' });
    } finally {
      setApprovingToLibrary(false);
    }
  };

  const saveRating = async (val: number) => {
    setRating(val);
    if (currentSummary) {
      await fetch(`/api/summaries/${currentSummary.id}/rate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rating: val })
      });
    }
  };

  const Field = ({ 
    labelEn, 
    labelZh, 
    fieldKey, 
    fallbackKey, 
    isEstimated = false 
  }: { 
    labelEn: string; 
    labelZh?: string; 
    fieldKey: string; 
    fallbackKey?: string; 
    isEstimated?: boolean; 
  }) => {
    const val = editData[fieldKey] || (fallbackKey ? editData[fallbackKey] : '') || '';
    const isDraftModified = draftPreview?.proposed_field_changes && (
      draftPreview.proposed_field_changes[fieldKey] !== undefined ||
      (fallbackKey && draftPreview.proposed_field_changes[fallbackKey] !== undefined)
    );

    return (
      <div className={`border p-2 flex flex-col justify-center min-h-[60px] group focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-transparent transition-all relative ${
        isDraftModified 
          ? 'bg-purple-50/70 border-purple-400 ring-1 ring-purple-300' 
          : 'bg-white border-neutral-300'
      }`}>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">{getLabel(labelEn, labelZh)}</span>
          {isDraftModified && (
            <span className="text-[9px] font-black uppercase tracking-wider bg-purple-200 text-purple-900 px-1.5 py-0.2 rounded-xs">
              Draft Preview
            </span>
          )}
        </div>
        <input 
          type="text"
          value={val}
          onChange={(e) => {
            handleFieldChange(fieldKey, e.target.value);
            if (fallbackKey && editData[fallbackKey] !== undefined) {
              handleFieldChange(fallbackKey, e.target.value);
            }
          }}
          placeholder={isEstimated ? 'Estimating...' : '---'}
          className={`w-full bg-transparent outline-none text-sm font-medium ${
            isDraftModified 
              ? 'text-purple-950 font-bold' 
              : isEstimated 
              ? 'text-purple-700 italic' 
              : 'text-neutral-900'
          } ${!val && 'placeholder:text-neutral-300'}`}
        />
      </div>
    );
  };

  return (
    <div className="bg-neutral-50 min-h-screen pb-12">
      
      {/* Lightbox Modal for Double-Click Zoom */}
      <ImageViewerModal
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        imageUrl={lightboxData.url}
        title={lightboxData.title}
        subtitle={lightboxData.subtitle}
      />

      {/* Pending Changes Queue Modal */}
      <PendingChangesModal
        isOpen={pendingModalOpen}
        onClose={() => setPendingModalOpen(false)}
        initialGarmentId={garment.id}
        onApplied={() => {
          if (onUpdated) onUpdated();
        }}
      />

      {/* Header */}
      <div className="border-b border-neutral-200 px-8 py-4 flex flex-wrap items-center justify-between sticky top-0 bg-white z-10 shadow-sm gap-4">
        <div className="flex items-center gap-4">
          <button 
            onClick={onClose}
            className="p-2 hover:bg-neutral-100 rounded-full transition-colors -ml-2"
          >
            <ArrowLeft className="w-5 h-5 text-neutral-600" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-neutral-900">{garment.id}</h1>
              <span className={`text-xs px-2.5 py-1 rounded-md font-bold tracking-wide ${editData.status === 'Approved' ? 'bg-green-100 text-green-800' : 'bg-orange-100 text-orange-700'}`}>
                {editData.status === 'Approved' ? 'APPROVED' : 'PENDING APPROVAL'}
              </span>
            </div>
            <p className="text-sm text-neutral-500 flex items-center gap-2 mt-0.5">
              <span>{editData.buyer || garment.brand || 'No Buyer'}</span>
              <span>•</span>
              <span className="inline-flex items-center gap-1 font-mono font-medium text-neutral-800 bg-neutral-100 px-2 py-0.5 rounded border border-neutral-200 text-xs">
                <MapPin className="w-3 h-3 text-orange-600" />
                {editData.assigned_location || editData.location || garment.location || 'Vault — 0001'}
              </span>
            </p>
          </div>
        </div>
        
        {/* Actions & Language */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex bg-neutral-100 p-1 rounded-lg border border-neutral-200 mr-2">
            <button 
              onClick={() => setLang('en')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${lang === 'en' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              EN
            </button>
            <button 
              onClick={() => setLang('zh')}
              className={`px-3 py-1 rounded-md text-xs font-bold transition-colors ${lang === 'zh' ? 'bg-white shadow-sm text-neutral-900' : 'text-neutral-500 hover:text-neutral-700'}`}
            >
              中文
            </button>
          </div>

          {/* Prominent "Re-run FGD" Trigger Button */}
          <button
            type="button"
            onClick={handleRerunFgd}
            disabled={rerunningFgd}
            className="px-3.5 py-2 bg-purple-600 hover:bg-purple-700 active:bg-purple-800 text-white rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-sm disabled:opacity-50"
            title="Re-run Zero-Omission vision extraction via Gemini on physical label and refresh view in-place"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${rerunningFgd ? 'animate-spin' : ''}`} />
            <span>{rerunningFgd ? 'Re-running FGD...' : 'Re-run FGD'}</span>
          </button>

          {/* Side-by-Side Inspection Mode Toggle Button */}
          <button
            type="button"
            onClick={() => setSideBySideMode(!sideBySideMode)}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
              sideBySideMode 
                ? 'bg-blue-600 hover:bg-blue-700 text-white border-blue-600 ring-2 ring-blue-400/40' 
                : 'bg-blue-50 hover:bg-blue-100 text-blue-950 border-blue-300'
            }`}
            title="Toggle Side-by-Side Inspection mode to audit high-res physical label alongside FGD form fields"
          >
            <Columns className={`w-3.5 h-3.5 ${sideBySideMode ? 'text-white' : 'text-blue-600'}`} />
            <span>{sideBySideMode ? 'Exit Split View' : 'Side-by-Side Inspection'}</span>
          </button>

          {/* New "Assign to Space" Trigger Button */}
          <button
            type="button"
            onClick={() => setAssignSpaceOpen(!assignSpaceOpen)}
            className={`px-3.5 py-2 rounded-lg font-bold text-xs transition-all flex items-center gap-1.5 cursor-pointer shadow-xs border ${
              assignSpaceOpen 
                ? 'bg-orange-600 hover:bg-orange-700 text-white border-orange-600 ring-2 ring-orange-400/40' 
                : 'bg-orange-50 hover:bg-orange-100 text-orange-950 border-orange-300'
            }`}
            title="Assign garment to physical warehouse stack and log organisation logic"
          >
            <MapPin className={`w-4 h-4 ${assignSpaceOpen ? 'text-white' : 'text-orange-600'}`} />
            <span>{assignSpaceOpen ? 'Close Space Box' : 'Assign to Space'}</span>
          </button>

          <button 
            onClick={() => setPendingModalOpen(true)}
            className="px-3 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-100 rounded-lg font-medium text-xs transition-colors flex items-center gap-1.5"
          >
            Pending Queue
          </button>

          <button 
            onClick={stageIntoPending}
            disabled={saving}
            className="px-4 py-2 border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 rounded-lg font-medium text-sm transition-colors shadow-sm"
          >
            {saving ? 'Queueing...' : 'Queue in Pending List'}
          </button>

          {/* Jennifer's Retake Request Trigger */}
          <button
            onClick={async () => {
              const reason = window.prompt("Reason for photo retake (e.g., Unfocused care label, needs zipper open shot):", "Blurry/Unfocused care label photo");
              if (!reason) return;
              try {
                const res = await fetch(`/api/garments/${garment.id}/request-retake`, {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ reason })
                });
                const data = await res.json();
                if (res.ok) {
                  setStatusNotification({
                    type: 'success',
                    message: `Garment ${garment.id} queued for photography retake! Sent to Capture station.`
                  });
                  setEditData((prev: any) => ({ ...prev, status: 'needs_reshoot' }));
                  if (onUpdated) onUpdated();
                } else {
                  throw new Error(data.error || 'Failed to request retake');
                }
              } catch (e: any) {
                setStatusNotification({ type: 'error', message: e.message });
              }
            }}
            className="px-3.5 py-2 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg font-bold text-xs transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
            title="Flag poor quality or missing shot for Chen at the Capture Photo Booth"
          >
            <Camera className="w-4 h-4 text-amber-700" />
            <span>Request Retake</span>
          </button>

          {/* Jennifer's Final Approval Authority: Approve & Move to Library */}
          {editData.status !== 'Approved' && (
            <button
              onClick={handleApproveAndMoveToLibrary}
              disabled={approvingToLibrary}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs transition-all shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              title="Senior Merchandiser Jennifer: Final Approval Authority - Move Garment to Active Library"
            >
              <CheckCircle className="w-4 h-4 text-white" />
              <span>{approvingToLibrary ? 'Approving...' : 'Approve & Move to Library'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Inline Expanding Warehouse Space Assignment Box */}
      {assignSpaceOpen && (
        <div className="max-w-[1600px] mx-auto px-8 pt-4">
          <SpaceAssignmentBox
            garment={{ ...garment, ...editData }}
            onClose={() => setAssignSpaceOpen(false)}
            onAssigned={(newLoc) => {
              setEditData((prev: any) => ({
                ...prev,
                location: newLoc,
                assigned_location: newLoc,
                shelving_status: 'shelved'
              }));
              setStatusNotification({
                type: 'success',
                message: `Garment ${garment.id} successfully shelved at physical space ${newLoc}. Stack capacity updated and organisation logic logged.`
              });
              if (onUpdated) onUpdated();
            }}
          />
        </div>
      )}

      {/* Notification Toast */}
      {statusNotification && (
        <div className={`mx-8 mt-4 p-4 rounded-xl border flex items-center justify-between text-sm ${statusNotification.type === 'success' ? 'bg-green-50 border-green-200 text-green-900' : 'bg-red-50 border-red-200 text-red-900'}`}>
          <div className="flex items-center gap-2">
            {statusNotification.type === 'success' ? <CheckCircle className="w-5 h-5 text-green-600" /> : <AlertTriangle className="w-5 h-5 text-red-600" />}
            <span>{statusNotification.message}</span>
          </div>
          <button onClick={() => setStatusNotification(null)} className="p-1 hover:bg-black/5 rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Draft Proposed Changes Preview Sticky Alert Banner */}
      {draftPreview && (
        <div className="max-w-[1600px] mx-auto px-8 pt-4">
          <div className="p-4 rounded-2xl border border-purple-300 bg-purple-100/90 text-purple-950 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-200 flex items-center justify-center shrink-0 text-purple-800">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[11px] font-black uppercase tracking-wider px-2 py-0.5 rounded bg-purple-200/90 text-purple-900">
                    Draft Preview Active • Uncommitted
                  </span>
                  <span className="text-xs font-semibold text-purple-800">
                    {draftPreview.affected_fields?.length || 0} fields updated in editor from Director commentary
                  </span>
                </div>
                <p className="text-xs text-purple-900 mt-0.5">
                  <strong>Notice:</strong> This garment is <em>not</em> approved and remains in Review Stage. Field changes are staged locally for verification.
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={handleDiscardDraftPreview}
                className="px-3 py-1.5 bg-white hover:bg-purple-50 text-purple-950 text-xs font-bold rounded-lg border border-purple-300 shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-purple-700" />
                <span>Discard Preview</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = document.getElementById('director-commentary-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className="px-3 py-1.5 bg-purple-700 hover:bg-purple-800 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <span>View Commentary Details</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Equated / Temporary / Handwritten Sticker Code Banner */}
      {isTemporaryGarment && (
        <div className="max-w-[1600px] mx-auto px-8 pt-4">
          <div className={`p-4 rounded-2xl border flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm ${
            garment.previous_generated_code 
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-950' 
              : isStickerCode 
              ? 'bg-amber-500/10 border-amber-500/30 text-amber-950' 
              : 'bg-blue-500/10 border-blue-500/30 text-blue-950'
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                garment.previous_generated_code ? 'bg-emerald-500/20 text-emerald-700' : isStickerCode ? 'bg-amber-500/20 text-amber-700' : 'bg-blue-500/20 text-blue-700'
              }`}>
                <Tag className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                    garment.previous_generated_code 
                      ? 'bg-emerald-200/80 text-emerald-900' 
                      : isStickerCode 
                      ? 'bg-amber-200/80 text-amber-900' 
                      : 'bg-blue-200/80 text-blue-900'
                  }`}>
                    {garment.previous_generated_code ? 'Equated Code Record' : isStickerCode ? 'Handwritten Sticker (Missing Label)' : 'Temporary Capture ID'}
                  </span>
                  <span className="font-mono text-sm font-bold text-neutral-900">{garment.id}</span>
                  {garment.previous_generated_code && (
                    <span className="text-xs text-emerald-800 font-medium">
                      (Equated from: <strong className="font-mono">{garment.previous_generated_code}</strong> by {garment.equated_by || 'Jennifer'})
                    </span>
                  )}
                </div>
                <p className="text-xs mt-1 leading-relaxed">
                  {garment.previous_generated_code ? (
                    <>Equated on {garment.equated_at ? new Date(garment.equated_at).toLocaleString() : 'recent session'}. {garment.equated_notes ? `Notes: "${garment.equated_notes}". ` : ''}All image files, database records, and background FGD jobs retain this link.</>
                  ) : isStickerCode ? (
                    <>Chen generated this code at Capture because of a missing care label. When Jennifer finds the original garment code, click <strong>Equate Code</strong> to permanently map it.</>
                  ) : suggestedStyleNo ? (
                    <>Care label OCR identified official style number <strong className="font-mono font-bold text-neutral-900">{suggestedStyleNo}</strong>.</>
                  ) : (
                    "Captured with a temporary ID. Assign or equate the official style number below or wait for OCR completion."
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {suggestedStyleNo && !garment.previous_generated_code && (
                <button
                  type="button"
                  onClick={() => handleRenameGarment(suggestedStyleNo)}
                  disabled={renameGarmentLoading}
                  className="px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
                  title="Rename entire garment and files to the OCR extracted style"
                >
                  {renameGarmentLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Rename to {suggestedStyleNo}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  setNewGarmentIdInput(suggestedStyleNo || '');
                  setRenameGarmentModalOpen(true);
                }}
                className="px-3.5 py-1.5 bg-white border border-neutral-300 hover:bg-neutral-50 text-neutral-900 rounded-xl text-xs font-bold transition-colors cursor-pointer flex items-center gap-1.5 shadow-xs"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>{garment.previous_generated_code ? 'Re-Equate Code' : isStickerCode ? 'Equate Code' : 'Custom Code'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Apply Approved Changes Activation Bar */}
      <div className="max-w-[1600px] mx-auto px-8 pt-6">
        <div className="bg-gradient-to-r from-neutral-900 to-neutral-800 text-white p-4 sm:p-5 rounded-2xl shadow-lg border border-neutral-700 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-400" />
              <h3 className="font-bold text-sm text-neutral-100 uppercase tracking-wider">
                Approval Activation Protocol
              </h3>
            </div>
            <p className="text-xs text-neutral-300 max-w-xl">
              To apply approved changes, update the hashtag taxonomy, and regenerate the Archival Summary, enter the activation syntax <span className="font-mono bg-neutral-800 text-green-300 px-1.5 py-0.5 rounded border border-neutral-700">Apply Approved Changes</span> below.
            </p>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto">
            <div className="relative flex-1 md:w-80">
              <input
                type="text"
                value={activationSyntax}
                onChange={(e) => setActivationSyntax(e.target.value)}
                placeholder='Type: "Apply Approved Changes"'
                className="w-full bg-neutral-800 border border-neutral-600 rounded-xl px-4 py-2 text-xs font-mono text-white placeholder:text-neutral-400 focus:ring-2 focus:ring-green-400 outline-none"
              />
              <button
                type="button"
                onClick={() => setActivationSyntax('Apply Approved Changes')}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 text-[10px] bg-neutral-700 hover:bg-neutral-600 text-neutral-200 px-2 py-0.5 rounded transition-colors"
              >
                Auto-fill
              </button>
            </div>
            <button
              onClick={activateApprovedChanges}
              disabled={activating || activationSyntax.trim().toLowerCase() !== 'apply approved changes'}
              className={`px-5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${activationSyntax.trim().toLowerCase() === 'apply approved changes' && !activating ? 'bg-green-500 hover:bg-green-400 text-neutral-950 shadow-md cursor-pointer' : 'bg-neutral-700 text-neutral-400 cursor-not-allowed'}`}
            >
              {activating ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Applying...</span>
                </>
              ) : (
                <>
                  <span>Activate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {sideBySideMode ? (
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <SideBySideInspector
            garment={{ ...garment, ...editData }}
            editData={editData}
            handleFieldChange={handleFieldChange}
            lang={lang}
            displayImages={displayImages}
            onRerunFgd={handleRerunFgd}
            rerunningFgd={rerunningFgd}
            onClose={() => setSideBySideMode(false)}
            onSavePending={stageIntoPending}
            saving={saving}
          />
        </div>
      ) : (
        <div className="max-w-[1600px] mx-auto px-8 py-8 grid grid-cols-1 xl:grid-cols-12 gap-8">
        
        {/* Left Column: Images with Double-Click Lightbox */}
        <div className="xl:col-span-5 space-y-4">
          <div 
            className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm relative group cursor-zoom-in"
            onDoubleClick={() => currentImgObj && handleOpenLightbox(currentImgObj.rawUrl || currentImgObj.fallbackUrl || (currentImgObj.filename ? `/images/${currentImgObj.filename}` : `/images/${garment.id} (F).jpg`), currentImgObj.role || 'Active View')}
            title="Double-click to call forward full resolution archive photo (Raw Tier)"
          >
            {currentImgObj && (currentImgObj.url || currentImgObj.fallbackUrl || currentImgObj.fullUrl) ? (
              <img 
                src={getImageSource(currentImgObj)} 
                alt={garment.id} 
                className="w-full h-auto object-contain bg-neutral-100 max-h-[70vh]"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  if (!target.src.includes('images/')) {
                    target.src = currentImgObj.fallbackUrl || `/images/${garment.id} (F).jpg`;
                  }
                }}
              />
            ) : (
              <div className="w-full h-64 flex flex-col items-center justify-center bg-neutral-100 text-neutral-400">
                <Camera className="w-8 h-8 text-neutral-300 mb-2" />
                <span className="text-sm font-medium">Pending Photo Upload</span>
              </div>
            )}
            {/* Double click hover prompt */}
            {currentImgObj && (
              <>
                <div className="absolute top-3 left-3 bg-black/75 backdrop-blur-md text-white text-[11px] font-medium px-3 py-1.5 rounded-lg flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
                  <ZoomIn className="w-3.5 h-3.5 text-orange-400" />
                  <span>Double-click to call forward full resolution (Raw Tier)</span>
                </div>
                <button
                  onClick={() => handleOpenLightbox(currentImgObj.rawUrl || currentImgObj.fallbackUrl || (currentImgObj.filename ? `/images/${currentImgObj.filename}` : `/images/${garment.id} (F).jpg`), currentImgObj.role || 'Active View')}
                  className="absolute bottom-3 right-3 bg-white/90 hover:bg-white text-neutral-800 text-xs font-bold px-3 py-1.5 rounded-lg shadow border border-neutral-200 flex items-center gap-1.5 transition-all"
                >
                  <ZoomIn className="w-4 h-4 text-neutral-600" />
                  Full Res
                </button>
              </>
            )}
          </div>

          {/* DUPLICATE / DIFFERENT SHOT ACTION TOOLBAR (User Directive) */}
          {currentImgObj && (
            <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm p-4 space-y-3 relative">
              {/* Review / Alternative Shot Notice Banner */}
              {(currentImgObj.isReview || currentImgObj.role?.includes('Review')) && (
                <div className="bg-amber-50 border border-amber-300/80 rounded-xl p-3 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-amber-900 leading-relaxed">
                    <strong className="font-semibold block text-amber-950">Alternative / Duplicate Shot Detected:</strong>
                    This photo was uploaded as a different shot for {currentImgObj.role?.replace(/\s*\(Review.*?\)/i, '') || 'this garment'}. You can permanently delete it or rename and keep it as an additional reference shot.
                  </div>
                </div>
              )}

              {/* Photo Meta & The Two Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[11px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md border ${
                    currentImgObj.isReview 
                      ? 'bg-amber-100 text-amber-800 border-amber-300' 
                      : 'bg-neutral-100 text-neutral-700 border-neutral-200'
                  }`}>
                    {currentImgObj.role || 'Photo'}
                  </span>
                  <span className="text-xs text-neutral-500 font-mono truncate max-w-[200px]" title={currentImgObj.filename}>
                    {currentImgObj.filename || `${garment.id}.jpg`}
                  </span>
                </div>

                {/* The Two Direct Action Buttons */}
                <div className="flex items-center gap-2">
                  {/* Button 1: Delete */}
                  <button
                    type="button"
                    onClick={() => handleOpenDeleteConfirm(currentImgObj)}
                    disabled={imageActionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-red-700 bg-red-50 hover:bg-red-100 active:bg-red-200 border border-red-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Permanently delete this photo"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>Delete</span>
                  </button>

                  {/* Button 2: Rename and keep */}
                  <button
                    type="button"
                    onClick={() => handleOpenRenameBubble(currentImgObj)}
                    disabled={imageActionLoading}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 active:bg-blue-200 border border-blue-200 rounded-lg transition-colors disabled:opacity-50 cursor-pointer shadow-xs"
                    title="Rename photo suffix and keep permanently"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-blue-600" />
                    <span>Rename and keep</span>
                  </button>
                </div>
              </div>

              {/* PROMPT BUBBLE: Rename and Keep (Garment Name Fixed, Suffix Customizable) */}
              {renameBubbleOpen && renameTargetImg && (
                <div className="mt-3 p-4 bg-blue-50/70 border-2 border-blue-300 rounded-xl relative shadow-md animate-in fade-in zoom-in-95 duration-150">
                  {/* Speech bubble pointer notch */}
                  <div className="absolute -top-2 right-12 w-4 h-4 bg-blue-50/70 border-t-2 border-l-2 border-blue-300 rotate-45" />

                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-blue-950">
                      <Tag className="w-3.5 h-3.5 text-blue-600" />
                      <span>Rename and Keep Photo</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRenameBubbleOpen(false)}
                      className="text-neutral-400 hover:text-neutral-600 p-0.5 rounded cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <p className="text-[11px] text-blue-900/80 mb-3">
                    The garment name part is fixed. Specify a custom end suffix to keep this shot without overwriting primary angles.
                  </p>

                  <div className="space-y-3">
                    {/* Fixed Garment Name + Editable Suffix Input */}
                    <div>
                      <label className="block text-[10px] font-bold uppercase tracking-wider text-neutral-600 mb-1">
                        Filename Construction
                      </label>
                      <div className="flex items-center rounded-lg border border-blue-300 bg-white shadow-inner overflow-hidden focus-within:ring-2 focus-within:ring-blue-500 focus-within:border-blue-500">
                        {/* Fixed Garment ID Part with Lock */}
                        <div className="flex items-center gap-1 bg-neutral-100 px-3 py-2 border-r border-neutral-300 text-xs font-mono font-bold text-neutral-800 select-none">
                          <Lock className="w-3 h-3 text-neutral-500" />
                          <span>{garment.id}</span>
                        </div>
                        {/* Editable Suffix */}
                        <input
                          type="text"
                          value={renameSuffix}
                          onChange={(e) => setRenameSuffix(e.target.value)}
                          placeholder="(F) Detail or Collar Close-up"
                          className="flex-1 px-3 py-2 text-xs font-mono text-neutral-900 bg-transparent focus:outline-none"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleConfirmRename();
                            if (e.key === 'Escape') setRenameBubbleOpen(false);
                          }}
                        />
                        <span className="px-2.5 py-2 text-xs font-mono text-neutral-400 bg-neutral-50 select-none">
                          .jpg
                        </span>
                      </div>
                    </div>

                    {/* Resulting Filename Live Preview */}
                    <div className="bg-white/80 rounded-md p-2 border border-blue-200/80 text-[11px] font-mono text-blue-900 flex items-center justify-between">
                      <span className="text-neutral-500">Result:</span>
                      <span className="font-bold truncate ml-2">
                        {garment.id} {renameSuffix.trim() ? renameSuffix.trim() : '(suffix)'}.jpg
                      </span>
                    </div>

                    {/* Quick Preset Chips */}
                    <div>
                      <span className="text-[10px] font-semibold text-neutral-500 uppercase tracking-wider block mb-1.5">
                        Quick Suffix Presets:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {['(F) Detail', '(F) Collar', '(B) Detail', 'Care Tag', 'Fabric Zoom', 'Shot 2'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setRenameSuffix(preset)}
                            className={`text-[11px] px-2 py-0.5 rounded border transition-colors cursor-pointer ${
                              renameSuffix === preset 
                                ? 'bg-blue-600 text-white border-blue-600 font-bold' 
                                : 'bg-white hover:bg-neutral-100 text-neutral-700 border-neutral-300'
                            }`}
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Action Buttons in Prompt Bubble */}
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => setRenameBubbleOpen(false)}
                        disabled={imageActionLoading}
                        className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg transition-colors cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        onClick={handleConfirmRename}
                        disabled={imageActionLoading || !renameSuffix.trim()}
                        className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 active:bg-blue-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                      >
                        {imageActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        <span>Save & Keep</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* DELETE CONFIRMATION BUBBLE */}
              {deleteConfirmOpen && deleteTargetImg && (
                <div className="mt-3 p-4 bg-red-50/80 border-2 border-red-300 rounded-xl relative shadow-md animate-in fade-in zoom-in-95 duration-150">
                  {/* Speech bubble pointer notch */}
                  <div className="absolute -top-2 right-28 w-4 h-4 bg-red-50/80 border-t-2 border-l-2 border-red-300 rotate-45" />

                  <div className="flex items-center gap-2 text-xs font-bold text-red-950 mb-1.5">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                    <span>Confirm Photo Deletion</span>
                  </div>
                  <p className="text-xs text-red-900/90 mb-3">
                    Are you sure you want to permanently delete <strong>{deleteTargetImg.filename || deleteTargetImg.role}</strong>? This file will be deleted from disk and database immediately.
                  </p>
                  <div className="flex items-center justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteConfirmOpen(false)}
                      disabled={imageActionLoading}
                      className="px-3 py-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-800 bg-white border border-neutral-200 rounded-lg cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={imageActionLoading}
                      className="inline-flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white bg-red-600 hover:bg-red-700 active:bg-red-800 rounded-lg shadow-sm transition-all disabled:opacity-50 cursor-pointer"
                    >
                      {imageActionLoading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>Confirm Delete</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Thumbnails */}
          <div className="grid grid-cols-3 gap-4">
            {displayImages.map((img: any, i: number) => {
              const fullSrc = img.rawUrl || img.fallbackUrl || (img.filename ? `/images/${img.filename}` : `/images/${garment.id} (F).jpg`);
              const thumbSrc = img.thumbUrl || img.url || (img.filename ? `/images_thumb/${img.filename}` : null) || getImageSource(img);
              return (
                <div 
                  key={i}
                  onClick={() => setSelectedImageIndex(i)}
                  onDoubleClick={() => handleOpenLightbox(fullSrc, img.role)}
                  className={`relative aspect-[4/3] rounded-xl overflow-hidden border-2 transition-all cursor-pointer group ${
                    selectedImageIndex === i ? 'border-blue-600 shadow-md ring-2 ring-blue-600/20' : 'border-transparent hover:border-neutral-300'
                  }`}
                  title="Click to view thumbnail, Double-click to call forward full resolution (Raw Tier)"
                >
                  {(img.url || img.fallbackUrl || img.fullUrl) ? (
                    <img 
                      src={thumbSrc} 
                      alt={`${garment.id} ${img.role}`} 
                      loading="lazy"
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = img.fallbackUrl || `/images/${garment.id} (F).jpg`;
                      }}
                    />
                  ) : (
                    <div className="w-full h-full bg-neutral-100 flex items-center justify-center text-neutral-400 text-xs font-medium">
                      {img.role || 'Image'}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1">
                    <span className="bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold px-2 py-1 rounded">
                      {img.role}
                    </span>
                    {img.isReview && (
                      <span className="bg-amber-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-xs">
                        Review
                      </span>
                    )}
                  </div>
                  <div className="absolute top-2 right-2 bg-black/50 text-white p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                    <ZoomIn className="w-3 h-3" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Structured Data, Dedicated Hashtag Section, & Summary */}
        <div className="xl:col-span-7 space-y-8">
          
          {/* Label Reconstruction Table */}
          <section className="bg-white p-8 rounded-2xl border border-neutral-200 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold text-neutral-900 tracking-tight">Structured Label Data</h2>
              <div className="flex items-center gap-2">
                 <div className="w-3 h-3 rounded-full bg-purple-100 border border-purple-500"></div>
                 <span className="text-xs text-neutral-500 font-medium">AI Estimated Fields</span>
              </div>
            </div>

            <div className="border-[3px] border-neutral-900 bg-neutral-300 gap-[1px] grid">
              
              <div className="bg-white p-4 text-center border-b-[3px] border-neutral-900">
                <h3 className="font-serif text-2xl font-bold tracking-widest text-neutral-900">WINZEN INTERNATIONAL LIMITED</h3>
              </div>

              <div className="grid grid-cols-5 gap-[1px]">
                <Field labelEn="BUYER" labelZh="客人" fieldKey="buyer" />
                <Field labelEn="BRAND CODE" labelZh="品牌代碼" fieldKey="brand_code" />
                <Field labelEn="SEASON" labelZh="季節" fieldKey="season" />
                <Field labelEn="SALES" labelZh="營業員" fieldKey="sales" />
                <Field labelEn="MERCHANDISER" labelZh="跟單員" fieldKey="merchandiser" />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="STYLE NO" labelZh="款式編號" fieldKey="y_style_no" />
                <div className="col-span-3 grid grid-cols-3 gap-[1px]">
                  <Field labelEn="CUST. STYLE NO." labelZh="客款號" fieldKey="cust_style_no" />
                  <Field labelEn="GOODS NO." labelZh="訂單號/貨號" fieldKey="goods_no" />
                  <Field labelEn="GARMENT TYPE" labelZh="樣辦類型" fieldKey="garment_type" />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-3">
                  <Field labelEn="BUYER FABRIC / MATERIAL" labelZh="布料成份" fieldKey="fabric_material" fallbackKey="fabric_raw" />
                </div>
                <Field labelEn="G.N.W." labelZh="重量" fieldKey="gnw_weight" isEstimated={garment.gnw_is_ai_estimated} />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <Field labelEn="WASHING" labelZh="洗滌方式" fieldKey="washing" />
                <div className="col-span-2">
                  <Field labelEn="CONSTRUCTION" labelZh="織法組織" fieldKey="fabric_construction" />
                </div>
                <Field labelEn="YARN COUNT" labelZh="紗支" fieldKey="fabric_yarn_count" />
              </div>

              <div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-2 grid grid-cols-2 gap-[1px]">
                  <Field labelEn="SAMPLE Job No." labelZh="辦單號" fieldKey="sample_job_no" />
                  <Field labelEn="COLOR" labelZh="顏色" fieldKey="color" isEstimated={garment.color_is_ai_estimated} />
                </div>
                <Field labelEn="SIZE" labelZh="尺碼" fieldKey="size" />
                
                <div className="bg-white p-2 flex flex-col items-center justify-center min-h-[60px] cursor-pointer hover:bg-neutral-50 transition-colors border border-neutral-300" onClick={() => setShowBarcode(true)}>
                  {!showBarcode ? (
                    <>
                      <BarcodeIcon className="w-5 h-5 text-neutral-400 mb-1" />
                      <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider text-center">{garment.id}-0001</span>
                    </>
                  ) : (
                    <div className="w-full flex justify-center scale-[0.65] origin-center -my-6">
                      <Barcode value={`${garment.id}-0001`} format="CODE128" width={2} height={40} displayValue={true} />
                    </div>
                  )}
                </div>
              </div>
              
              <div className="grid grid-cols-4 gap-[1px]">
                <div className="col-span-3 grid grid-cols-1 gap-[1px]">
                  <Field labelEn="DESCRIPTION" labelZh="內容描述" fieldKey="description" />
                  <Field labelEn="REMARK / MEMO" labelZh="備註" fieldKey="remark_memo" />
                  <Field labelEn="HANDWRITTEN NOTES" labelZh="手寫筆記 / 標籤註記" fieldKey="handwritten_notes" />
                </div>
                <div className="col-span-1">
                  <Field labelEn="PRINT DATETIME" labelZh="列印時間" fieldKey="print_datetime" />
                </div>
              </div>

            </div>
          </section>

          {/* DEDICATED HASHTAG SECTION (Requirement 4 & 5) */}
          <section className="bg-white p-7 rounded-2xl border border-neutral-200 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b border-neutral-100 pb-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                  <Hash className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-neutral-900">Hashtags & Semantic Indexing</h3>
                  <p className="text-xs text-neutral-500">Taxonomy tags for visual styling, materials, and expanded retrieval</p>
                </div>
              </div>
            </div>

            {/* 1. Visible Hashtags */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-neutral-700 uppercase tracking-wider flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Visible Hashtags (Primary Classification)
                </span>
                <span className="text-xs text-neutral-400 font-mono">{visibleTagsList.length} tags</span>
              </div>

              <div className="flex flex-wrap gap-2 min-h-[40px] p-3 bg-neutral-50 rounded-xl border border-neutral-200">
                {visibleTagsList.length === 0 ? (
                  <span className="text-xs text-neutral-400 italic">No visible hashtags defined yet.</span>
                ) : (
                  visibleTagsList.map((tag) => (
                    <span 
                      key={tag} 
                      className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 border border-blue-200 text-blue-800 text-xs font-medium rounded-lg group shadow-2xs"
                    >
                      <span>{tag}</span>
                      <button
                        type="button"
                        onClick={() => removeVisibleTag(tag)}
                        className="text-blue-400 hover:text-blue-700 p-0.5 rounded transition-colors"
                        title="Remove tag"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))
                )}
              </div>

              {/* Add Visible Tag Input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Hash className="w-3.5 h-3.5 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newVisibleTag}
                    onChange={(e) => setNewVisibleTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addVisibleTag(newVisibleTag);
                      }
                    }}
                    placeholder="Add visible hashtag (e.g. reactive_tie_dye, half_zip, s_cafe)..."
                    className="w-full pl-8 pr-4 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addVisibleTag(newVisibleTag)}
                  className="px-4 py-2 bg-neutral-900 text-white text-xs font-bold rounded-lg hover:bg-black transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Add
                </button>
              </div>
            </div>

            {/* 2. Invisible / Search Disambiguation Hashtags */}
            <div className="space-y-3 pt-4 border-t border-neutral-100">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Search className="w-3.5 h-3.5 text-purple-600" />
                  Invisible / Similarity Search Hashtags
                </span>
                <span className="text-xs text-purple-500 font-mono">{invisibleTagsList.length} indexed</span>
              </div>

              <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
                <p className="text-[11px] text-purple-900/80 leading-relaxed">
                  <span className="font-semibold">Search Expansion Engine: </span>
                  These tags are indexed in the background to capture search queries for potential ambiguous variants (such as indexing <span className="font-mono bg-purple-100 text-purple-900 px-1 rounded">#pigment_tie_dye</span> for garments diagnosed as <span className="font-mono bg-blue-100 text-blue-900 px-1 rounded">#reactive_tie_dye</span> per Rule-005). They do not clutter the primary factory spec sheet.
                </p>

                <div className="flex flex-wrap gap-2 pt-1">
                  {invisibleTagsList.length === 0 ? (
                    <span className="text-xs text-purple-400 italic">No invisible similarity search tags indexed.</span>
                  ) : (
                    invisibleTagsList.map((tag) => (
                      <span 
                        key={tag} 
                        className="inline-flex items-center gap-1.5 px-3 py-1 bg-white border border-purple-200 text-purple-800 text-xs font-medium rounded-lg group shadow-2xs"
                      >
                        <Search className="w-2.5 h-2.5 text-purple-400" />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => removeInvisibleTag(tag)}
                          className="text-purple-400 hover:text-purple-700 p-0.5 rounded transition-colors"
                          title="Remove search tag"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Add Invisible Tag Input */}
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="w-3.5 h-3.5 text-purple-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    value={newInvisibleTag}
                    onChange={(e) => setNewInvisibleTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        addInvisibleTag(newInvisibleTag);
                      }
                    }}
                    placeholder="Add invisible search hashtag (e.g. pigment_tie_dye, vintage_wash, fleece_jacket)..."
                    className="w-full pl-8 pr-4 py-2 text-xs border border-neutral-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => addInvisibleTag(newInvisibleTag)}
                  className="px-4 py-2 bg-purple-700 text-white text-xs font-bold rounded-lg hover:bg-purple-800 transition-colors flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Index Tag
                </button>
              </div>
            </div>
          </section>

          {/* Archival Summary section */}
          <section className="bg-neutral-900 rounded-2xl overflow-hidden shadow-lg border border-black">
            <div className="px-6 py-4 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></div>
                <h3 className="text-sm font-bold text-white tracking-widest uppercase">Archival Summary</h3>
                <span className="ml-2 bg-neutral-800 text-neutral-300 text-[10px] px-2 py-0.5 rounded-full border border-neutral-700">
                  Version {summariesList.length || 1}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button 
                    key={star} 
                    onClick={() => saveRating(star)}
                    className="p-1 transition-transform hover:scale-110"
                  >
                    <Star className={`w-4 h-4 ${star <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-neutral-600'}`} />
                  </button>
                ))}
              </div>
            </div>
            <div className="p-6">
              <p className="text-neutral-300 font-serif leading-relaxed whitespace-pre-wrap text-base sm:text-lg">
                {currentSummary?.summary_text || garment.jennifer_emulator_raw || "Waiting for baseline analysis..."}
              </p>
            </div>
          </section>

          {/* Director Jason Chun Ho Lee Commentary & Dual Flash/Pro Review Section */}
          <section id="director-commentary-section" className="bg-white rounded-2xl border border-purple-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-purple-100 bg-gradient-to-r from-purple-50 via-neutral-50 to-indigo-50 flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2.5">
                <Scale className="w-5 h-5 text-purple-700" />
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-black text-neutral-900 tracking-tight">Director / Technical Commentary</h3>
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-purple-100 text-purple-900 border border-purple-300">
                      Director Jason (Developer)
                    </span>
                  </div>
                  <p className="text-[11px] text-neutral-500">
                    Draft observations, factory code clarifications, or questions without approving the garment.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-50 text-amber-900 border border-amber-200 text-[11px]">
                  <Zap className="w-3 h-3 text-amber-600" /> Flash: gemini-3.8-flash
                </span>
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-900 border border-indigo-200 text-[11px]">
                  <Brain className="w-3 h-3 text-indigo-600" /> Pro: gemini-3.1-pro-preview
                </span>
              </div>
            </div>

            <div className="p-5 space-y-4">
              {/* Unresolved Discrepancies Reference for Jason */}
              {garment.reviewer_feedback && (
                <div className="bg-amber-50 border border-amber-300 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-amber-700" />
                    <span className="text-[11px] font-bold text-amber-900 uppercase">
                      FGD Discrepancies Routed for Review:
                    </span>
                  </div>
                  <p className="text-xs text-neutral-800 whitespace-pre-wrap font-medium pl-6">
                    {garment.reviewer_feedback}
                  </p>
                </div>
              )}

              {/* Jason's Commentary Textarea */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-semibold text-neutral-700">
                  <label htmlFor="director-commentary-input">
                    Jason's Technical Observations & Field Corrections:
                  </label>
                  {commentSaveSuccess && (
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Draft saved to disk
                    </span>
                  )}
                </div>
                <textarea
                  id="director-commentary-input"
                  value={directorComment}
                  onChange={(e) => setDirectorComment(e.target.value)}
                  placeholder="e.g., Tag note 'BMA' under HB is a Winzen internal factory marker, NOT Hugo Boss Black Men. Winzen style is 20S-1004-2, keep cust_style_no as HAVOOG 50443691. Under permanent brand architecture, this belongs to BOSS pillar..."
                  rows={4}
                  className="w-full p-3.5 border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-y text-sm text-neutral-800 placeholder:text-neutral-400 bg-neutral-50/50"
                />
              </div>

              {/* Action Buttons: Save Draft | Digest Comments (Preview Only) | Re-run FGD (Flash) | Deep Arbitration (Pro) */}
              <div className="flex items-center justify-between flex-wrap gap-2 pt-1 border-t border-neutral-100">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleSaveDirectorComment}
                    disabled={savingDirectorComment || !directorComment.trim()}
                    className="px-4 py-2 border border-neutral-300 bg-white hover:bg-neutral-50 text-neutral-800 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5 text-neutral-600" />
                    <span>{savingDirectorComment ? 'Saving Draft...' : 'Save Draft Commentary'}</span>
                  </button>

                  {/* DIGEST DIRECTOR'S COMMENTS (PREVIEW ONLY - NO APPROVAL) */}
                  <button
                    type="button"
                    onClick={handleDigestFeedbackPreview}
                    disabled={digestingDraft || !directorComment.trim()}
                    className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white font-black text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    title="Translate natural language comments into proposed field modifications as a live interactive preview WITHOUT approving or saving to catalog"
                  >
                    <Sparkles className="w-4 h-4 text-purple-200" />
                    <span>{digestingDraft ? 'Digesting Feedback...' : "Digest Director's Comments (Preview Only)"}</span>
                  </button>
                </div>

                <div className="flex items-center gap-2">
                  {/* Interactive Re-run Garment FGD (Flash Model) */}
                  <button
                    type="button"
                    onClick={handleRerunGarmentFgdFlash}
                    disabled={flashVerifying || !directorComment.trim()}
                    className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-neutral-950 font-black text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    title="Real-time check with gemini-3.8-flash to verify if discrepancy clears"
                  >
                    <Zap className="w-4 h-4 text-neutral-950" />
                    <span>{flashVerifying ? 'Flash Verifying...' : 'Re-run Garment FGD (Flash)'}</span>
                  </button>

                  {/* Deep Discrepancy Arbitration (Pro Model) */}
                  <button
                    type="button"
                    onClick={handleRunProArbitration}
                    disabled={proArbitrating || !directorComment.trim()}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs rounded-lg transition-all shadow-xs flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                    title="Deep Discrepancy Arbitration with gemini-3.1-pro-preview for conflicting rules, acronyms, and brand hierarchy"
                  >
                    <Brain className="w-4 h-4 text-white" />
                    <span>{proArbitrating ? 'Pro Arbitrating...' : 'Deep Arbitration (Pro)'}</span>
                  </button>
                </div>
              </div>

              {/* DRAFT PROPOSED CHANGES PREVIEW CARD (Digested from commentary, Preview Only) */}
              {draftPreview && (
                <div className="p-4 rounded-xl border border-purple-300 bg-purple-50/60 transition-all space-y-3 shadow-xs">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-purple-600 animate-pulse" />
                      <span className="text-xs font-black uppercase tracking-wider text-purple-900 flex items-center gap-1.5">
                        <Sparkles className="w-4 h-4 text-purple-600" />
                        Draft Proposed Changes Preview (Uncommitted)
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold text-purple-800 bg-purple-200/80 px-2 py-0.5 rounded">
                        Preview Mode • Not in Library
                      </span>
                      <button
                        type="button"
                        onClick={handleDiscardDraftPreview}
                        className="px-2.5 py-1 bg-white hover:bg-neutral-100 border border-neutral-300 text-neutral-700 text-[11px] font-bold rounded flex items-center gap-1 transition-colors"
                        title="Discard preview and restore original values"
                      >
                        <RotateCcw className="w-3 h-3 text-neutral-500" /> Discard Preview
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <h4 className="text-xs font-bold text-purple-950">{draftPreview.summary}</h4>
                    <p className="text-xs text-purple-900 leading-relaxed whitespace-pre-wrap">
                      {draftPreview.explanation}
                    </p>
                  </div>

                  {draftPreview.proposed_field_changes && Object.keys(draftPreview.proposed_field_changes).length > 0 && (
                    <div className="bg-white/95 p-3 rounded-lg border border-purple-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-purple-950 uppercase tracking-wider">
                          Digested Field Adjustments ({Object.keys(draftPreview.proposed_field_changes).length}):
                        </span>
                        <span className="text-[10px] text-neutral-500 italic">
                          Highlighted in purple with "Draft Preview" tags above
                        </span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                        {Object.entries(draftPreview.proposed_field_changes).map(([k, v]) => (
                          <div key={k} className="p-2 bg-purple-50/50 rounded border border-purple-100 flex items-start justify-between gap-2">
                            <span className="font-mono font-bold text-purple-900 text-[11px] shrink-0">{k}:</span>
                            <span className="text-neutral-900 text-[11px] text-right break-all font-medium">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between text-[11px] text-purple-900/80 pt-1 border-t border-purple-200/60">
                    <span>
                      Digested at {new Date(draftPreview.digested_at).toLocaleTimeString()} via {draftPreview.model}
                    </span>
                    <span className="font-semibold text-purple-800">
                      Catalog tables are untouched. Ready for Senior Merchandiser review.
                    </span>
                  </div>
                </div>
              )}

              {/* FLASH MODEL EVALUATION OUTCOME */}
              {flashEvaluation && (
                <div className={`p-4 rounded-xl border transition-all ${
                  flashEvaluation.cleared 
                    ? 'bg-emerald-50/80 border-emerald-300 text-emerald-950' 
                    : 'bg-amber-50/80 border-amber-300 text-amber-950'
                }`}>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className={`w-4 h-4 ${flashEvaluation.cleared ? 'text-emerald-700' : 'text-amber-700'}`} />
                      <span className="text-xs font-black uppercase tracking-wider">
                        Flash Verification Result ({flashEvaluation.model || 'gemini-3.8-flash'})
                      </span>
                    </div>
                    <span className={`px-2 py-0.5 text-[11px] font-black rounded ${
                      flashEvaluation.cleared 
                        ? 'bg-emerald-200 text-emerald-900 border border-emerald-300' 
                        : 'bg-amber-200 text-amber-900 border border-amber-300'
                    }`}>
                      {flashEvaluation.verdict || (flashEvaluation.cleared ? 'Discrepancy Cleared' : 'Requires Review')}
                    </span>
                  </div>

                  <p className="text-xs leading-relaxed whitespace-pre-wrap mb-3 font-medium">
                    {flashEvaluation.explanation}
                  </p>

                  {/* Proposed Field Corrections from Flash */}
                  {flashEvaluation.proposed_fields && Object.keys(flashEvaluation.proposed_fields).length > 0 && (
                    <div className="bg-white/80 p-3 rounded-lg border border-emerald-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-emerald-900">
                          Proposed Field Updates:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyProposedFields(flashEvaluation.proposed_fields)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold rounded flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Adopt Field Corrections
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(flashEvaluation.proposed_fields).map(([k, v]) => (
                          <div key={k} className="p-1.5 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-mono text-[10px] text-neutral-500 uppercase block">{k}:</span>
                            <span className="font-semibold text-neutral-900">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {flashEvaluation.remaining_discrepancies && flashEvaluation.remaining_discrepancies.length > 0 && (
                    <div className="mt-2 text-xs text-amber-800">
                      <strong>Remaining Questions:</strong> {flashEvaluation.remaining_discrepancies.join(', ')}
                    </div>
                  )}
                </div>
              )}

              {/* PRO MODEL DEEP ARBITRATION OUTCOME */}
              {proArbitration && (
                <div className="p-4 rounded-xl border border-indigo-200 bg-indigo-50/70 text-indigo-950 space-y-3">
                  <div className="flex items-center justify-between gap-2 border-b border-indigo-200/80 pb-2">
                    <div className="flex items-center gap-2">
                      <Brain className="w-4 h-4 text-indigo-700" />
                      <span className="text-xs font-black uppercase tracking-wider text-indigo-950">
                        Deep Discrepancy Arbitration ({proArbitration.model || 'gemini-3.1-pro-preview'})
                      </span>
                    </div>
                    <span className="px-2 py-0.5 text-[10px] font-black rounded bg-indigo-200 text-indigo-900 border border-indigo-300">
                      Brand & Code Disambiguation Complete
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <h4 className="text-xs font-bold text-indigo-900">{proArbitration.summary}</h4>
                    <p className="text-xs leading-relaxed text-neutral-800 whitespace-pre-wrap">
                      {proArbitration.explanation}
                    </p>
                  </div>

                  {/* Brand Hierarchy & Isolation Analysis */}
                  {proArbitration.brand_hierarchy_analysis && (
                    <div className="bg-white/90 p-3 rounded-lg border border-indigo-200 space-y-1">
                      <div className="flex items-center gap-1.5 text-xs font-black text-indigo-950">
                        <Scale className="w-3.5 h-3.5 text-indigo-600" />
                        <span>Brand Hierarchy & Code Isolation Standards:</span>
                      </div>
                      <p className="text-xs text-neutral-700 leading-relaxed whitespace-pre-wrap">
                        {proArbitration.brand_hierarchy_analysis}
                      </p>
                    </div>
                  )}

                  {/* Field Corrections from Pro */}
                  {proArbitration.field_corrections && Object.keys(proArbitration.field_corrections).length > 0 && (
                    <div className="bg-white/90 p-3 rounded-lg border border-indigo-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-indigo-900">
                          Structured Field Corrections:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleApplyProposedFields(proArbitration.field_corrections)}
                          className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold rounded flex items-center gap-1"
                        >
                          <Check className="w-3 h-3" /> Adopt Corrections
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-xs">
                        {Object.entries(proArbitration.field_corrections).map(([k, v]) => (
                          <div key={k} className="p-1.5 bg-neutral-50 rounded border border-neutral-200">
                            <span className="font-mono text-[10px] text-neutral-500 uppercase block">{k}:</span>
                            <span className="font-semibold text-neutral-900">{String(v)}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Proposed Catalog Rule */}
                  {proArbitration.proposed_rule && (
                    <div className="bg-white/95 p-3.5 rounded-lg border border-purple-300 space-y-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 font-mono text-[11px] font-black bg-purple-100 text-purple-900 rounded border border-purple-300">
                            {proArbitration.proposed_rule.rule_code}
                          </span>
                          <span className="text-xs font-bold text-neutral-900">
                            {proArbitration.proposed_rule.rule_title}
                          </span>
                        </div>
                        <button
                          type="button"
                          disabled={proposedRuleStaged}
                          onClick={() => handleStageProposedRule(proArbitration.proposed_rule)}
                          className={`px-3 py-1 text-xs font-bold rounded flex items-center gap-1 transition-colors ${
                            proposedRuleStaged 
                              ? 'bg-emerald-100 text-emerald-800 border border-emerald-300 cursor-default'
                              : 'bg-neutral-900 hover:bg-black text-white cursor-pointer'
                          }`}
                        >
                          {proposedRuleStaged ? (
                            <>
                              <Check className="w-3.5 h-3.5" /> Staged to Catalog
                            </>
                          ) : (
                            <>
                              <Plus className="w-3.5 h-3.5" /> Stage Rule for Jennifer's Approval
                            </>
                          )}
                        </button>
                      </div>

                      <div className="text-xs text-neutral-700 space-y-1">
                        <div>
                          <strong className="text-neutral-900">Trigger:</strong> {proArbitration.proposed_rule.condition_trigger}
                        </div>
                        <div>
                          <strong className="text-neutral-900">Instruction:</strong> {proArbitration.proposed_rule.rule_instruction}
                        </div>
                        {proArbitration.proposed_rule.positive_example && (
                          <div className="text-emerald-800 text-[11px]">
                            <strong>Positive Standard:</strong> {proArbitration.proposed_rule.positive_example}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Jennifer Approval Authority Confirmation Banner */}
              <div className="p-3.5 rounded-xl bg-neutral-50 border border-neutral-200 flex items-center justify-between flex-wrap gap-3">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                  <p className="text-xs text-neutral-600">
                    <strong>Merchandiser Approval Hierarchy:</strong> Final catalog promotion authority remains exclusively with Senior Merchandiser Jennifer.
                  </p>
                </div>
                {editData.status !== 'Approved' ? (
                  <button
                    type="button"
                    onClick={handleApproveAndMoveToLibrary}
                    disabled={approvingToLibrary}
                    className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{approvingToLibrary ? 'Approving...' : 'Approve & Move to Library'}</span>
                  </button>
                ) : (
                  <span className="px-3 py-1 bg-emerald-100 text-emerald-800 border border-emerald-200 rounded-lg text-xs font-bold flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5" /> Approved Catalog Record
                  </span>
                )}
              </div>

            </div>
          </section>

          {/* Structural Feedback section */}
          <section className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-100 bg-blue-50 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-blue-900 tracking-tight">Structural Feedback & Rules Feedback</h3>
              </div>
              {garment.reviewer_feedback && (
                <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-full bg-amber-100 text-amber-800 border border-amber-300">
                  FGD Questions for Review
                </span>
              )}
            </div>
            <div className="p-4 space-y-3">
              {garment.reviewer_feedback && (
                <div className="bg-amber-50/90 border border-amber-300/80 rounded-xl p-3.5 space-y-1.5 shadow-2xs">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 text-[10px] font-black uppercase rounded bg-amber-200 text-amber-900 border border-amber-300">
                      Unresolved Discrepancies Routed for Review
                    </span>
                  </div>
                  <p className="text-xs text-neutral-800 whitespace-pre-wrap leading-relaxed">
                    {garment.reviewer_feedback}
                  </p>
                </div>
              )}
              <textarea
                value={editData.structural_feedback}
                onChange={(e) => handleFieldChange('structural_feedback', e.target.value)}
                placeholder="Request systemic changes, new fields, or schema updates here..."
                className="w-full h-24 p-3 border border-neutral-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none resize-y text-sm text-neutral-700 placeholder:text-neutral-400"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={stageIntoPending}
                  disabled={saving}
                  className="px-4 py-2 bg-neutral-900 hover:bg-black text-white text-xs font-bold rounded-lg transition-colors"
                >
                  {saving ? 'Queueing...' : 'Stage Feedback to Pending List'}
                </button>
              </div>
            </div>
          </section>

        </div>
      </div>
      )}

      {/* RENAME / EQUATE GARMENT MODAL */}
      {renameGarmentModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl border border-neutral-200">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold text-neutral-900 text-base">
                  {isStickerCode ? 'Equate Missing Label Code to Official Style' : 'Rename / Equate Garment Identifier'}
                </h3>
              </div>
              <button onClick={() => setRenameGarmentModalOpen(false)} className="p-1 hover:bg-neutral-100 rounded-lg">
                <X className="w-5 h-5 text-neutral-500" />
              </button>
            </div>
            <p className="text-xs text-neutral-600 mb-4 leading-relaxed">
              {isStickerCode 
                ? 'Equate Chen’s temporary handwritten sticker code to the official garment code found by Jennifer. The system preserves the historical link, re-links all associated photography views, and updates the catalog.'
                : 'Renaming updates the official style number in the catalog, preserves all merchandising specifications, re-links all associated photography views, and renames files on disk.'}
            </p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  {isStickerCode ? 'Previous Generated Sticker Code' : 'Current Identifier'}
                </label>
                <input
                  type="text"
                  disabled
                  value={garment.id}
                  className="w-full px-3 py-2 bg-neutral-100 border border-neutral-300 rounded-xl text-xs font-mono font-bold text-neutral-600"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  {isStickerCode ? 'Corrected / Official Garment Code (e.g. 20S-1004-2)' : 'New Style Code (e.g. 20S-1004-2)'}
                </label>
                <input
                  type="text"
                  value={newGarmentIdInput}
                  onChange={(e) => setNewGarmentIdInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameGarment(newGarmentIdInput);
                    if (e.key === 'Escape') setRenameGarmentModalOpen(false);
                  }}
                  placeholder="20S-1004-2"
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs font-mono font-bold text-neutral-900 focus:outline-none focus:ring-2 focus:ring-amber-500"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">Reference Notes (Optional)</label>
                <input
                  type="text"
                  value={equateNotesInput}
                  onChange={(e) => setEquateNotesInput(e.target.value)}
                  placeholder="e.g. Found in physical folder under 20S Fall Delivery 2"
                  className="w-full px-3 py-2 bg-white border border-neutral-300 rounded-xl text-xs text-neutral-800 focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                type="button"
                onClick={() => setRenameGarmentModalOpen(false)}
                className="px-4 py-2 border border-neutral-300 text-neutral-700 hover:bg-neutral-50 rounded-xl text-xs font-semibold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleRenameGarment(newGarmentIdInput)}
                disabled={renameGarmentLoading || !newGarmentIdInput.trim()}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-sm transition-colors cursor-pointer flex items-center gap-1.5 disabled:opacity-50"
              >
                {renameGarmentLoading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                <span>{isStickerCode ? 'Equate & Update Catalog' : 'Confirm Rename'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
