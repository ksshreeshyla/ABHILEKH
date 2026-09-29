import React, { useState, useEffect, useMemo } from 'react';
import { useArchive } from '../../context/ArchiveContext';
import { KnowledgeNode } from '../../types/archive';
import { INITIAL_KNOWLEDGE_LINKS, INITIAL_KNOWLEDGE_NODES } from '../../data/archiveData';
import { 
  Network, 
  Filter, 
  ExternalLink, 
  FileText, 
  Info, 
  User, 
  BookOpen, 
  Sparkles, 
  Calendar 
} from 'lucide-react';

export const KnowledgeMap: React.FC = () => {
  const { navigateTo, archiveItems, selectedKnowledgeNodeId, setSelectedKnowledgeNodeId } = useArchive();
  const knowledgeNodes = INITIAL_KNOWLEDGE_NODES;
  const knowledgeLinks = INITIAL_KNOWLEDGE_LINKS;
  const [selectedNode, setSelectedNode] = useState<KnowledgeNode | null>(() => {
    if (selectedKnowledgeNodeId) {
      const match = knowledgeNodes.find(n => n.id === selectedKnowledgeNodeId);
      if (match) return match;
    }
    return knowledgeNodes[0] || null;
  });
  const [filterCategory, setFilterCategory] = useState<string>('All');

  useEffect(() => {
    const match = selectedKnowledgeNodeId
      ? knowledgeNodes.find(n => n.id === selectedKnowledgeNodeId)
      : undefined;
    if (match) {
      setSelectedNode(match);
    } else if (knowledgeNodes[0]) {
      setSelectedNode(knowledgeNodes[0]);
    }
  }, [selectedKnowledgeNodeId, knowledgeNodes]);

  const categories = ['All', 'Person', 'Constitutional Idea', 'Work', 'Historical Event', 'Document'];

  if (!selectedNode || knowledgeNodes.length === 0) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center p-8 text-center">
        <div className="max-w-lg rounded-xl border border-stone-300 bg-white p-8 shadow-xs">
          <Network className="mx-auto mb-4 h-8 w-8 text-stone-400" />
          <h2 className="font-serif text-xl font-bold text-stone-900">Knowledge graph unavailable</h2>
          <p className="mt-2 text-sm text-stone-600">The illustrative demo graph could not be loaded.</p>
        </div>
      </div>
    );
  }

  const filteredNodes = knowledgeNodes.filter(n => {
    if (filterCategory === 'All') return true;
    return n.category === filterCategory;
  });

  const getCategoryColor = (cat: string) => {
    switch (cat) {
      case 'Person': return '#3b82f6';
      case 'Constitutional Idea': return '#d97706';
      case 'Work': return '#10b981';
      case 'Historical Event': return '#8b5cf6';
      case 'Document': return '#64748b';
      default: return '#78716c';
    }
  };

  // Keep Dr. Ambedkar central and distribute the demo nodes around the hub.
  const nodePositions = useMemo(() => Object.fromEntries(
    knowledgeNodes.map(node => {
      if (node.id === 'dr-ambedkar') return [node.id, { x: 350, y: 260 }];
      const surroundingNodes = knowledgeNodes.filter(candidate => candidate.id !== 'dr-ambedkar');
      const positionIndex = surroundingNodes.findIndex(candidate => candidate.id === node.id);
      const angle = (positionIndex / surroundingNodes.length) * Math.PI * 2 - Math.PI / 2;
      return [node.id, { x: 350 + Math.cos(angle) * 205, y: 260 + Math.sin(angle) * 195 }];
    })
  ), [knowledgeNodes]);
  const visibleLinks = knowledgeLinks.filter(link => nodePositions[link.source] && nodePositions[link.target]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      {/* Header */}
      <div className="border-b border-stone-300 pb-4 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl font-bold text-stone-900 tracking-tight">
            Interactive Knowledge Map
          </h1>
          <p className="text-sm text-stone-600 mt-1">
            Explore key people, writings, events, and ideas connected with Dr. Ambedkar's public life and work.
          </p>
          <p className="mt-3 inline-flex items-center gap-2 rounded-full border border-amber-500/40 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-950">
            <Info className="h-3.5 w-3.5" /> Demo graph · illustrative connections · not live database relationships
          </p>
        </div>

        {/* Filter categories */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-semibold text-stone-500 mr-1 flex items-center gap-1">
            <Filter className="w-3.5 h-3.5" />
            <span>Filter Entities:</span>
          </span>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setFilterCategory(cat)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                filterCategory === cat
                  ? 'bg-stone-900 text-stone-100 shadow-xs'
                  : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Main Grid: SVG Canvas + Details Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* SVG Graph View (8 cols) */}
        <div className="lg:col-span-8 bg-stone-900 rounded-2xl border border-stone-800 p-4 shadow-xl overflow-hidden relative">
          <div className="flex items-center justify-between text-xs text-stone-400 border-b border-stone-800 pb-2 mb-2 font-mono">
            <span>ILLUSTRATIVE RELATIONSHIP MAP</span>
            <span>Nodes: {filteredNodes.length} · Links: {visibleLinks.length}</span>
          </div>

          <div className="w-full overflow-x-auto">
            <svg
              viewBox="0 0 700 520"
              className="w-full min-w-[600px] h-[480px] select-none"
            >
              {/* Background Grid Pattern */}
              <defs>
                <pattern id="graph-grid" width="30" height="30" patternUnits="userSpaceOnUse">
                  <path d="M 30 0 L 0 0 0 30" fill="none" stroke="#292524" strokeWidth="0.5" />
                </pattern>
              </defs>
              <rect width="100%" height="100%" fill="url(#graph-grid)" />

              {/* Connecting Edges */}
              {visibleLinks.map((link, idx) => {
                const s = nodePositions[link.source];
                const t = nodePositions[link.target];
                if (!s || !t) return null;

                const isConnectedToSelected = 
                  selectedNode.id === link.source || selectedNode.id === link.target;

                return (
                  <g key={idx}>
                    <line
                      x1={s.x}
                      y1={s.y}
                      x2={t.x}
                      y2={t.y}
                      stroke={isConnectedToSelected ? '#fbbf24' : '#44403c'}
                      strokeWidth={isConnectedToSelected ? 2.5 : 1.2}
                      strokeDasharray={isConnectedToSelected ? 'none' : '3 3'}
                      className="transition-all"
                    />
                  </g>
                );
              })}

              {/* Render Nodes */}
              {knowledgeNodes.map((node) => {
                const pos = nodePositions[node.id];
                const isSelected = selectedNode.id === node.id;
                const isDimmed = filterCategory !== 'All' && node.category !== filterCategory;
                const color = getCategoryColor(node.category);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${pos.x}, ${pos.y})`}
                    onClick={() => { setSelectedNode(node); setSelectedKnowledgeNodeId(node.id); }}
                    role="button"
                    tabIndex={0}
                    aria-label={`Select ${node.label}`}
                    onKeyDown={event => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedNode(node);
                        setSelectedKnowledgeNodeId(node.id);
                      }
                    }}
                    className="cursor-pointer transition-all duration-200"
                    opacity={isDimmed ? 0.3 : 1}
                  >
                    {/* Pulsing ring around selected node */}
                    {isSelected && (
                      <circle
                        r="32"
                        fill="none"
                        stroke="#fbbf24"
                        strokeWidth="2"
                        className="animate-ping opacity-60"
                      />
                    )}

                    {/* Outer Circle */}
                    <circle
                      r={node.id === 'dr-ambedkar' ? 28 : 22}
                      fill="#1c1917"
                      stroke={isSelected ? '#fbbf24' : color}
                      strokeWidth={isSelected ? 3 : 2}
                      className="transition-all shadow-md"
                    />

                    {/* Center Core dot */}
                    <circle
                      r={node.id === 'dr-ambedkar' ? 8 : 5}
                      fill={color}
                    />

                    {/* Node Text Label */}
                    <text
                      y={node.id === 'dr-ambedkar' ? 42 : 36}
                      textAnchor="middle"
                      fill={isSelected ? '#fbbf24' : '#e7e5e4'}
                      fontSize={node.id === 'dr-ambedkar' ? '12' : '10'}
                      fontWeight={isSelected ? 'bold' : 'normal'}
                      className="font-sans pointer-events-none drop-shadow"
                    >
                      {node.label}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-stone-400 pt-3 border-t border-stone-800">
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500"></span>
              <span>Person</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
              <span>Constitutional Idea</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
              <span>Work</span>
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
              <span>Historical Event</span>
            </span>
          </div>
        </div>

        {/* Node Inspector Drawer (4 cols) */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-stone-300 shadow-md p-6 space-y-5">
          <div className="border-b border-stone-200 pb-3 space-y-1">
            <div className="flex items-center justify-between text-xs font-mono">
              <span 
                className="font-bold uppercase tracking-wider"
                style={{ color: getCategoryColor(selectedNode.category) }}
              >
                {selectedNode.category}
              </span>
              <span className="text-stone-400">Node ID: {selectedNode.id}</span>
            </div>
            <h2 className="font-serif font-bold text-xl text-stone-900 pt-1">
              {selectedNode.label}
            </h2>
          </div>

          <div className="space-y-2 text-xs text-stone-700 leading-relaxed font-sans">
            <p>{selectedNode.description}</p>
          </div>

          {/* Linked Relationships */}
          <div className="space-y-2 pt-2 border-t border-stone-200 text-xs">
            <span className="font-semibold text-stone-800 uppercase tracking-wider block">
              Illustrative Connections:
            </span>
            <div className="space-y-1.5">
              {knowledgeLinks
                .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
                .map((l, i) => {
                  const otherId = l.source === selectedNode.id ? l.target : l.source;
                  const otherNode = knowledgeNodes.find(n => n.id === otherId);
                  return (
                    <div
                      key={i}
                      onClick={() => otherNode && setSelectedNode(otherNode)}
                      className="p-2 bg-stone-50 hover:bg-stone-100 border border-stone-200 rounded text-stone-800 flex items-center justify-between cursor-pointer transition-colors"
                    >
                      <span className="font-medium text-stone-900">{otherNode?.label || otherId}</span>
                      <span className="text-[11px] text-stone-500 italic">({l.relationship})</span>
                    </div>
                  );
                })}
            </div>
          </div>

          {/* Link to Primary Document if available */}
          {selectedNode.relatedDocId && (
            <div className="pt-2 border-t border-stone-200 space-y-2">
              <span className="text-xs font-semibold text-stone-800 uppercase tracking-wider block">
                Direct Archival Source:
              </span>
              {(() => {
                const doc = archiveItems.find(d => d.id === selectedNode.relatedDocId);
                if (!doc) return null;
                return (
                  <button
                    onClick={() => navigateTo('explorer', { docId: doc.id })}
                    className="w-full text-left p-3 bg-stone-900 text-stone-100 hover:bg-stone-800 rounded-lg text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors"
                  >
                    <div>
                      <span className="text-[10px] text-amber-400 font-mono block">{doc.archiveId}</span>
                      <span className="font-serif font-bold text-xs">{doc.title}</span>
                    </div>
                    <ExternalLink className="w-4 h-4 text-amber-400 shrink-0" />
                  </button>
                );
              })()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
