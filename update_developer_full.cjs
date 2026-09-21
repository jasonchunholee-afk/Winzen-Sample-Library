const fs = require('fs');

const content = `import { useState, useEffect } from 'react';
import { 
  Database, 
  Download, 
  RefreshCw, 
  Eye, 
  BookOpen, 
  ShieldAlert, 
  CheckCircle2, 
  XCircle, 
  Plus, 
  Clock, 
  Search, 
  Filter, 
  Tag, 
  Layers,
  Sparkles
} from 'lucide-react';
import { GarmentDetail } from './GarmentDetail';

interface Rule {
  id: number;
  rule_code: string;
  rule_type: 'positive' | 'negative';
  target_field: string;
  rule_title: string;
  condition_trigger: string;
  rule_instruction: string;
  example_positive?: string;
  example_negative?: string;
  source_feedback?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface Abbreviation {
  id: number;
  term: string;
  category: string;
  expansion_en: string;
  expansion_zh?: string;
  functional_notes?: string;
  source?: string;
  created_at: string;
  updated_at: string;
}

export function Developer() {
  const [activeTab, setActiveTab] = useState<'garments' | 'rules' | 'glossary'>('rules');
  const [garments, setGarments] = useState<any[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [abbreviations, setAbbreviations] = useState<Abbreviation[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedGarment, setSelectedGarment] = useState<any | null>(null);

  // Filters
  const [ruleSearch, setRuleSearch] = useState('');
  const [ruleTypeFilter, setRuleTypeFilter] = useState<'all' | 'positive' | 'negative'>('all');
  const [glossarySearch, setGlossarySearch] = useState('');
  const [glossaryCategory, setGlossaryCategory] = useState<string>('all');

  // Modal states for adding
  const [showAddRule, setShowAddRule] = useState(false);
  const [showAddGlossary, setShowAddGlossary] = useState(false);
  const [newRule, setNewRule] = useState({
    rule_code: '',
    rule_type: 'positive',
    target_field: 'garment_type',
    rule_title: '',
    condition_trigger: '',
    rule_instruction: '',
    example_positive: '',
    example_negative: '',
    source_feedback: 'Jennifer Review Round 1'
  });
  const [newGlossary, setNewGlossary] = useState({
    term: '',
    category: 'fiber/material',
    expansion_en: '',
    expansion_zh: '',
    functional_notes: '',
    source: 'Jennifer Review Round 1'
  });

  useEffect(() => {
    fetchAll();
  }, []);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [garmentRes, rulesRes, abbrRes] = await Promise.all([
        fetch('/api/garments'),
        fetch('/api/rules'),
        fetch('/api/abbreviations')
      ]);
      const [gData, rData, aData] = await Promise.all([
        garmentRes.json(),
        rulesRes.json(),
        abbrRes.json()
      ]);
      setGarments(gData || []);
      setRules(rData || []);
      setAbbreviations(aData || []);
    } catch (err) {
      console.error("Fetch error:", err);
    }
    setLoading(false);
  };

  const handleToggleRule = async (id: number) => {
    try {
      const res = await fetch(\`/api/rules/\${id}/toggle\`, { method: 'PATCH' });
      if (res.ok) {
        const updated = await res.json();
        setRules(prev => prev.map(r => r.id === id ? { ...r, is_active: updated.is_active } : r));
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newRule)
      });
      if (res.ok) {
        setShowAddRule(false);
        setNewRule({
          rule_code: '',
          rule_type: 'positive',
          target_field: 'garment_type',
          rule_title: '',
          condition_trigger: '',
          rule_instruction: '',
          example_positive: '',
          example_negative: '',
          source_feedback: 'Jennifer Review Round 1'
        });
        fetchAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateGlossary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/abbreviations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newGlossary)
      });
      if (res.ok) {
        setShowAddGlossary(false);
        setNewGlossary({
          term: '',
          category: 'fiber/material',
          expansion_en: '',
          expansion_zh: '',
          functional_notes: '',
          source: 'Jennifer Review Round 1'
        });
        fetchAll();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatTimestamp = (ts: string) => {
    if (!ts) return '-';
    try {
      const d = new Date(ts);
      return d.toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return ts;
    }
  };

  if (selectedGarment) {
    return (
      <GarmentDetail 
        garment={selectedGarment} 
        onClose={() => { 
          setSelectedGarment(null); 
          fetchAll(); 
        }} 
      />
    );
  }

  const filteredRules = rules.filter(r => {
    const matchSearch = (r.rule_code + ' ' + r.rule_title + ' ' + r.rule_instruction + ' ' + r.target_field)
      .toLowerCase()
      .includes(ruleSearch.toLowerCase());
    const matchType = ruleTypeFilter === 'all' || r.rule_type === ruleTypeFilter;
    return matchSearch && matchType;
  });

  const filteredGlossary = abbreviations.filter(a => {
    const matchSearch = (a.term + ' ' + a.expansion_en + ' ' + (a.expansion_zh || '') + ' ' + (a.functional_notes || ''))
      .toLowerCase()
      .includes(glossarySearch.toLowerCase());
    const matchCategory = glossaryCategory === 'all' || a.category === glossaryCategory;
    return matchSearch && matchCategory;
  });

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white p-6 rounded-2xl border border-neutral-200 shadow-sm gap-4">
        <div>
          <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-3">
            <Database className="w-6 h-6 text-neutral-800" />
            Developer Control Console
          </h1>
          <p className="text-neutral-500 mt-1 text-sm">
            Live Cloud SQL configuration, autonomous labeling patterns, and terminology library.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={fetchAll} 
            className="px-4 py-2 border border-neutral-300 rounded-lg flex items-center gap-2 hover:bg-neutral-50 text-sm font-medium transition-colors"
          >
            <RefreshCw className={\`w-4 h-4 \${loading ? 'animate-spin' : ''}\`} />
            Sync Database
          </button>
          <a 
            href="/library.db" 
            download 
            className="px-4 py-2 bg-neutral-900 text-white rounded-lg flex items-center gap-2 hover:bg-black text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Database
          </a>
        </div>
      </div>

      {/* Navigation Sub-Tabs */}
      <div className="flex border-b border-neutral-200 bg-white px-6 rounded-xl border">
        <button
          onClick={() => setActiveTab('rules')}
          className={\`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 -mb-px transition-colors \${
            activeTab === 'rules'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }\`}
        >
          <ShieldAlert className="w-4 h-4 text-amber-500" />
          Labelling Rules & Patterns
          <span className="bg-neutral-100 text-neutral-700 text-xs px-2 py-0.5 rounded-full font-bold">
            {rules.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('glossary')}
          className={\`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 -mb-px transition-colors \${
            activeTab === 'glossary'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }\`}
        >
          <BookOpen className="w-4 h-4 text-blue-500" />
          Abbreviations & Translation Library
          <span className="bg-neutral-100 text-neutral-700 text-xs px-2 py-0.5 rounded-full font-bold">
            {abbreviations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('garments')}
          className={\`flex items-center gap-2 py-4 px-4 font-semibold text-sm border-b-2 -mb-px transition-colors \${
            activeTab === 'garments'
              ? 'border-neutral-900 text-neutral-900'
              : 'border-transparent text-neutral-500 hover:text-neutral-800'
          }\`}
        >
          <Layers className="w-4 h-4 text-purple-500" />
          Garments Cloud Database
          <span className="bg-neutral-100 text-neutral-700 text-xs px-2 py-0.5 rounded-full font-bold">
            {garments.length}
          </span>
        </button>
      </div>

      {/* ======================= TAB 1: RULES & PATTERNS ======================= */}
      {activeTab === 'rules' && (
        <div className="space-y-6">
          {/* Controls Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search rules, triggers, target fields..."
                  value={ruleSearch}
                  onChange={(e) => setRuleSearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg w-full outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <div className="flex bg-neutral-100 p-1 rounded-lg text-xs font-semibold">
                <button
                  onClick={() => setRuleTypeFilter('all')}
                  className={\`px-3 py-1 rounded-md transition-colors \${ruleTypeFilter === 'all' ? 'bg-white shadow-xs text-neutral-900' : 'text-neutral-500 hover:text-neutral-900'}\`}
                >
                  All ({rules.length})
                </button>
                <button
                  onClick={() => setRuleTypeFilter('positive')}
                  className={\`px-3 py-1 rounded-md transition-colors \${ruleTypeFilter === 'positive' ? 'bg-white shadow-xs text-emerald-700' : 'text-neutral-500 hover:text-emerald-600'}\`}
                >
                  Positive ({rules.filter(r => r.rule_type === 'positive').length})
                </button>
                <button
                  onClick={() => setRuleTypeFilter('negative')}
                  className={\`px-3 py-1 rounded-md transition-colors \${ruleTypeFilter === 'negative' ? 'bg-white shadow-xs text-rose-700' : 'text-neutral-500 hover:text-rose-600'}\`}
                >
                  Negative ({rules.filter(r => r.rule_type === 'negative').length})
                </button>
              </div>
            </div>

            <button
              onClick={() => setShowAddRule(true)}
              className="px-4 py-2 bg-neutral-900 text-white hover:bg-black rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors self-end sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add New Rule
            </button>
          </div>

          {/* Rules List Cards */}
          <div className="grid grid-cols-1 gap-4">
            {filteredRules.map(rule => (
              <div 
                key={rule.id}
                className={\`bg-white rounded-xl border p-6 shadow-xs transition-all \${
                  rule.rule_type === 'negative' 
                    ? 'border-rose-200 hover:border-rose-300' 
                    : 'border-neutral-200 hover:border-neutral-300'
                }\`}
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b border-neutral-100 pb-4 mb-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-xs bg-neutral-100 text-neutral-800 px-2.5 py-1 rounded-md">
                      {rule.rule_code}
                    </span>
                    <span className={\`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full flex items-center gap-1.5 \${
                      rule.rule_type === 'negative'
                        ? 'bg-rose-100 text-rose-800 border border-rose-200'
                        : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                    }\`}>
                      {rule.rule_type === 'negative' ? (
                        <>
                          <XCircle className="w-3.5 h-3.5 text-rose-600" />
                          Negative Rule (What NOT To Do)
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                          Positive Rule (Detection Pattern)
                        </>
                      )}
                    </span>
                    <span className="text-xs bg-neutral-100 text-neutral-600 font-medium px-2 py-0.5 rounded">
                      Field: <strong className="text-neutral-900">{rule.target_field}</strong>
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-neutral-500">
                    <span className="flex items-center gap-1 font-mono text-[11px]" title={rule.created_at}>
                      <Clock className="w-3.5 h-3.5 text-neutral-400" />
                      {formatTimestamp(rule.created_at)}
                    </span>
                    <button
                      onClick={() => handleToggleRule(rule.id)}
                      className={\`px-2.5 py-1 rounded-md font-semibold text-xs transition-colors \${
                        rule.is_active 
                          ? 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100' 
                          : 'bg-neutral-100 text-neutral-400 hover:bg-neutral-200'
                      }\`}
                    >
                      {rule.is_active ? 'Active' : 'Disabled'}
                    </button>
                  </div>
                </div>

                <h3 className="text-base font-bold text-neutral-900 mb-2">{rule.rule_title}</h3>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm mt-3">
                  <div className="bg-neutral-50 p-3.5 rounded-lg border border-neutral-100">
                    <span className="text-[11px] font-bold uppercase text-neutral-500 tracking-wider block mb-1">
                      Trigger Condition
                    </span>
                    <p className="text-neutral-700">{rule.condition_trigger}</p>
                  </div>

                  <div className={\`p-3.5 rounded-lg border \${
                    rule.rule_type === 'negative' ? 'bg-rose-50/60 border-rose-100' : 'bg-blue-50/60 border-blue-100'
                  }\`}>
                    <span className={\`text-[11px] font-bold uppercase tracking-wider block mb-1 \${
                      rule.rule_type === 'negative' ? 'text-rose-700' : 'text-blue-700'
                    }\`}>
                      Instruction & Action
                    </span>
                    <p className="text-neutral-800 font-medium">{rule.rule_instruction}</p>
                  </div>
                </div>

                {(rule.example_positive || rule.example_negative) && (
                  <div className="mt-3 flex flex-col sm:flex-row gap-3 text-xs pt-3 border-t border-neutral-100">
                    {rule.example_positive && (
                      <div className="flex-1 bg-emerald-50/40 border border-emerald-100 p-2.5 rounded-lg">
                        <strong className="text-emerald-800 block mb-0.5">Recommended Output:</strong>
                        <span className="text-emerald-950 font-mono">{rule.example_positive}</span>
                      </div>
                    )}
                    {rule.example_negative && (
                      <div className="flex-1 bg-rose-50/40 border border-rose-100 p-2.5 rounded-lg">
                        <strong className="text-rose-800 block mb-0.5">Forbidden Pattern (What NOT To Do):</strong>
                        <span className="text-rose-950 font-mono">{rule.example_negative}</span>
                      </div>
                    )}
                  </div>
                )}

                {rule.source_feedback && (
                  <div className="mt-3 text-[11px] text-neutral-400 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>Origin: <strong>{rule.source_feedback}</strong></span>
                  </div>
                )}
              </div>
            ))}

            {filteredRules.length === 0 && (
              <div className="p-12 text-center bg-white rounded-xl border border-neutral-200 text-neutral-500">
                No labeling rules match your search criteria.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================= TAB 2: GLOSSARY & ABBREVIATIONS ======================= */}
      {activeTab === 'glossary' && (
        <div className="space-y-6">
          {/* Controls */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-xl border border-neutral-200">
            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search abbreviations, terms, translations..."
                  value={glossarySearch}
                  onChange={(e) => setGlossarySearch(e.target.value)}
                  className="pl-9 pr-4 py-1.5 text-sm bg-neutral-50 border border-neutral-200 rounded-lg w-full outline-none focus:ring-2 focus:ring-neutral-900"
                />
              </div>

              <select
                value={glossaryCategory}
                onChange={(e) => setGlossaryCategory(e.target.value)}
                className="py-1.5 px-3 text-xs bg-neutral-50 border border-neutral-200 rounded-lg font-medium outline-none"
              >
                <option value="all">All Categories</option>
                <option value="buyer/brand">Buyer / Brand</option>
                <option value="fiber/material">Fiber / Material</option>
                <option value="garment/style">Garment / Style</option>
                <option value="factory/code">Factory / Code</option>
                <option value="unit">Unit</option>
              </select>
            </div>

            <button
              onClick={() => setShowAddGlossary(true)}
              className="px-4 py-2 bg-neutral-900 text-white hover:bg-black rounded-lg text-sm font-semibold flex items-center gap-2 transition-colors self-end sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Add Term
            </button>
          </div>

          {/* Glossary Table */}
          <div className="bg-white rounded-xl border border-neutral-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-normal">
                <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
                  <tr>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Term / Code</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Category</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">English Expansion</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Chinese (中文)</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Functional Context & Notes</th>
                    <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {filteredGlossary.map(term => (
                    <tr key={term.id} className="hover:bg-neutral-50/80 transition-colors">
                      <td className="px-6 py-4 font-mono font-bold text-neutral-900 text-sm">
                        <span className="bg-blue-50 text-blue-800 border border-blue-200 px-2 py-1 rounded">
                          {term.term}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[11px] font-semibold uppercase bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded">
                          {term.category}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-semibold text-neutral-900">
                        {term.expansion_en}
                      </td>
                      <td className="px-6 py-4 text-neutral-800">
                        {term.expansion_zh || '-'}
                      </td>
                      <td className="px-6 py-4 text-xs text-neutral-600 max-w-sm">
                        {term.functional_notes || '-'}
                      </td>
                      <td className="px-6 py-4 text-[11px] font-mono text-neutral-400 whitespace-nowrap" title={term.created_at}>
                        {formatTimestamp(term.created_at)}
                      </td>
                    </tr>
                  ))}
                  {filteredGlossary.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-6 py-12 text-center text-neutral-400">
                        No terms match your search.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ======================= TAB 3: GARMENTS DATABASE ======================= */}
      {activeTab === 'garments' && (
        <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm whitespace-nowrap">
              <thead className="bg-neutral-100 border-b border-neutral-200 text-neutral-600">
                <tr>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">ID</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Buyer</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Garment Type</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Structural Feedback</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Status</th>
                  <th className="px-6 py-3 font-bold uppercase tracking-wider text-[10px]">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {garments.map(g => (
                  <tr key={g.id} className="hover:bg-neutral-50">
                    <td className="px-6 py-4 font-mono text-neutral-900 font-bold">{g.id}</td>
                    <td className="px-6 py-4">{g.buyer || '-'}</td>
                    <td className="px-6 py-4 font-medium text-neutral-800">{g.garment_type || '-'}</td>
                    <td className="px-6 py-4 text-neutral-500 max-w-[240px] truncate" title={g.structural_feedback || g.reviewer_feedback || ''}>
                      {g.structural_feedback || g.reviewer_feedback || '-'}
                    </td>
                    <td className="px-6 py-4">
                      <span className={\`text-xs font-bold px-2.5 py-1 rounded-full \${
                        g.status === 'Approved' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                      }\`}>
                        {g.status || 'Pending'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <button 
                        onClick={() => setSelectedGarment(g)}
                        className="px-3.5 py-1.5 bg-neutral-900 text-white hover:bg-black rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors shadow-sm"
                      >
                        <Eye className="w-3.5 h-3.5" /> View & Approve
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD RULE ======================= */}
      {showAddRule && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold text-neutral-900">Add New Labelling Rule / Pattern</h2>
            <form onSubmit={handleCreateRule} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Rule Code</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. RULE-008 or NEG-005"
                    value={newRule.rule_code}
                    onChange={e => setNewRule({ ...newRule, rule_code: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Rule Type</label>
                  <select
                    value={newRule.rule_type}
                    onChange={e => setNewRule({ ...newRule, rule_type: e.target.value as any })}
                    className="w-full border border-neutral-300 rounded-lg p-2"
                  >
                    <option value="positive">Positive (What to Do / Detection Pattern)</option>
                    <option value="negative">Negative (What NOT to Do / Anti-Pattern)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Target Field</label>
                <select
                  value={newRule.target_field}
                  onChange={e => setNewRule({ ...newRule, target_field: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                >
                  <option value="garment_type">garment_type</option>
                  <option value="fabric_raw">fabric_raw</option>
                  <option value="fabric_material">fabric_material</option>
                  <option value="gnw_weight">gnw_weight</option>
                  <option value="description">description</option>
                  <option value="hashtags">hashtags</option>
                  <option value="buyer">buyer</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Rule Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Half-Zip Pullover Classification"
                  value={newRule.rule_title}
                  onChange={e => setNewRule({ ...newRule, rule_title: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Condition / Trigger</label>
                <textarea
                  required
                  rows={2}
                  placeholder="When does this rule activate? (e.g. When zipper stops at chest)"
                  value={newRule.condition_trigger}
                  onChange={e => setNewRule({ ...newRule, condition_trigger: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Instruction & Action</label>
                <textarea
                  required
                  rows={2}
                  placeholder="Exact directive for AI model and reviewers"
                  value={newRule.rule_instruction}
                  onChange={e => setNewRule({ ...newRule, rule_instruction: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Positive Example</label>
                  <input
                    type="text"
                    placeholder="e.g. Half-Zip Pullover"
                    value={newRule.example_positive}
                    onChange={e => setNewRule({ ...newRule, example_positive: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg p-2 font-mono text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Negative Example (Forbidden)</label>
                  <input
                    type="text"
                    placeholder="e.g. Jacket"
                    value={newRule.example_negative}
                    onChange={e => setNewRule({ ...newRule, example_negative: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg p-2 font-mono text-xs text-rose-700"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddRule(false)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-black font-semibold"
                >
                  Save Rule
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: ADD GLOSSARY ======================= */}
      {showAddGlossary && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-4">
            <h2 className="text-xl font-bold text-neutral-900">Add Term to Translation Library</h2>
            <form onSubmit={handleCreateGlossary} className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Term / Abbreviation</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. S.Cafe, PU, BGM"
                    value={newGlossary.term}
                    onChange={e => setNewGlossary({ ...newGlossary, term: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg p-2 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-neutral-700 mb-1 text-xs">Category</label>
                  <select
                    value={newGlossary.category}
                    onChange={e => setNewGlossary({ ...newGlossary, category: e.target.value })}
                    className="w-full border border-neutral-300 rounded-lg p-2"
                  >
                    <option value="fiber/material">Fiber / Material</option>
                    <option value="buyer/brand">Buyer / Brand</option>
                    <option value="garment/style">Garment / Style</option>
                    <option value="factory/code">Factory / Code</option>
                    <option value="unit">Unit</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">English Expansion</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Polyurethane / Boss Green Men"
                  value={newGlossary.expansion_en}
                  onChange={e => setNewGlossary({ ...newGlossary, expansion_en: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Chinese Translation (中文)</label>
                <input
                  type="text"
                  placeholder="e.g. 聚氨酯 / 綠標男裝"
                  value={newGlossary.expansion_zh}
                  onChange={e => setNewGlossary({ ...newGlossary, expansion_zh: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div>
                <label className="block font-semibold text-neutral-700 mb-1 text-xs">Functional Context & Notes</label>
                <textarea
                  rows={2}
                  placeholder="Why is this term important? Special properties or factory rules..."
                  value={newGlossary.functional_notes}
                  onChange={e => setNewGlossary({ ...newGlossary, functional_notes: e.target.value })}
                  className="w-full border border-neutral-300 rounded-lg p-2"
                />
              </div>

              <div className="flex justify-end gap-3 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddGlossary(false)}
                  className="px-4 py-2 text-neutral-600 hover:bg-neutral-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-neutral-900 text-white rounded-lg hover:bg-black font-semibold"
                >
                  Save Term
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`;

fs.writeFileSync('src/components/Developer.tsx', content);
console.log("Updated Developer.tsx with full Rules & Glossary UI");
