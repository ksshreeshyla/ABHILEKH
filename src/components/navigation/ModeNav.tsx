import React from 'react';
import { useArchive, AppView } from '../../context/ArchiveContext';
import { 
  Compass, 
  Library, 
  FileText, 
  Clock, 
  Network, 
  Headphones, 
  Bot, 
  GitCompare, 
  Bookmark, 
  LayoutDashboard, 
  UploadCloud, 
  History,
  Camera
} from 'lucide-react';

export const ModeNav: React.FC = () => {
  const { mode, view, navigateTo, setMode } = useArchive();

  interface NavItem {
    id: AppView;
    label: string;
    icon: React.ReactNode;
  }

  const visitorItems: NavItem[] = [
    { id: 'home', label: 'Memorial Exhibition', icon: <Compass className="w-4 h-4" /> },
    { id: 'archive', label: 'Digital Archive', icon: <Library className="w-4 h-4" /> },
    { id: 'explorer', label: 'Document Explorer & OCR', icon: <FileText className="w-4 h-4" /> },
    { id: 'heritage360', label: '360° Heritage Viewer', icon: <Camera className="w-4 h-4" /> },
    { id: 'timeline', label: 'Chronological Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'knowledgemap', label: 'Knowledge Map', icon: <Network className="w-4 h-4" /> },
    { id: 'audiovideo', label: 'Audio & Video', icon: <Headphones className="w-4 h-4" /> },
    { id: 'assistant', label: 'AI Research Assistant', icon: <Bot className="w-4 h-4" /> },
  ];

  const researchItems: NavItem[] = [
    { id: 'archive', label: 'Archival Catalog', icon: <Library className="w-4 h-4" /> },
    { id: 'explorer', label: 'Full-Text & OCR Inspector', icon: <FileText className="w-4 h-4" /> },
    { id: 'heritage360', label: '360° Heritage Viewer', icon: <Camera className="w-4 h-4" /> },
    { id: 'timeline', label: 'Chronological Timeline', icon: <Clock className="w-4 h-4" /> },
    { id: 'compare', label: 'Document Comparison', icon: <GitCompare className="w-4 h-4" /> },
    { id: 'collections', label: 'Research Binder & Citations', icon: <Bookmark className="w-4 h-4" /> },
    { id: 'assistant', label: 'AI Assistant (Grounded RAG)', icon: <Bot className="w-4 h-4" /> },
    { id: 'knowledgemap', label: 'Knowledge Graph', icon: <Network className="w-4 h-4" /> },
  ];

  const adminItems: NavItem[] = [
    { id: 'admin_dashboard', label: 'Repository Dashboard', icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'admin_upload', label: 'Ingestion & OCR Extraction', icon: <UploadCloud className="w-4 h-4" /> },
    { id: 'archive', label: 'Document CMS & Status', icon: <Library className="w-4 h-4" /> },
    { id: 'admin_audit', label: 'Audit Trail & Preservation', icon: <History className="w-4 h-4" /> },
  ];

  let items = visitorItems;
  if (mode === 'research') items = researchItems;
  if (mode === 'admin') items = adminItems;

  return (
    <nav className="bg-stone-100 border-b border-stone-300 shadow-xs px-4 overflow-x-auto scrollbar-none">
      <div className="max-w-7xl mx-auto flex items-center gap-1 sm:gap-2 py-1.5 min-w-max">
        {items.map(item => {
          const isActive = view === item.id;
          return (
            <button
              key={item.id}
              onClick={() => navigateTo(item.id)}
              className={`flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium transition-colors cursor-pointer ${
                isActive
                  ? 'bg-stone-900 text-stone-100 shadow-sm'
                  : 'text-stone-700 hover:text-stone-950 hover:bg-stone-200/70'
              }`}
            >
              <span className={isActive ? 'text-amber-400' : 'text-stone-500'}>
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}

        {mode === 'admin' && (
          <div className="ml-auto pl-4 border-l border-stone-300">
            <button
              onClick={() => setMode('visitor')}
              className="px-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-800 rounded-md text-xs font-semibold cursor-pointer"
            >
              ← Exit Archivist Desk
            </button>
          </div>
        )}
      </div>
    </nav>
  );
};
