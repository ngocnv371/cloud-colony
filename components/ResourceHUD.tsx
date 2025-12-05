
import React, { useMemo } from 'react';
import { useGame } from '../store/gameStore';
import { Box, Wheat, Hammer, Mountain, Coins, Drumstick, Database } from 'lucide-react';

const ResourceHUD: React.FC = () => {
  const { state } = useGame();
  const { structures, pawns } = state;

  const resources = useMemo(() => {
    const counts: Record<string, number> = {};

    const add = (name: string, qty: number) => {
      counts[name] = (counts[name] || 0) + qty;
    };

    structures.forEach(s => s.inventory.forEach(i => add(i.name, i.quantity)));
    pawns.forEach(p => p.inventory.forEach(i => add(i.name, i.quantity)));

    return Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  }, [structures, pawns]);

  const getIcon = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes('meat') || lower.includes('meal')) return <Drumstick size={14} className="text-orange-400" />;
      if (lower.includes('rice') || lower.includes('potato') || lower.includes('corn') || lower.includes('berry')) return <Wheat size={14} className="text-yellow-400" />;
      if (lower.includes('wood')) return <Box size={14} className="text-amber-600" />;
      if (lower.includes('stone') || lower.includes('boulder')) return <Mountain size={14} className="text-stone-400" />;
      if (lower.includes('steel')) return <Hammer size={14} className="text-blue-300" />;
      if (lower.includes('gold') || lower.includes('silver') || lower.includes('uranium')) return <Coins size={14} className="text-yellow-200" />;
      return <Box size={14} className="text-gray-500" />;
  };

  return (
    <div className="absolute top-4 left-4 bg-gray-900/80 backdrop-blur-md border border-gray-700 p-3 rounded-lg shadow-xl z-40 pointer-events-none min-w-[180px] select-none transition-all duration-300">
      <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-wider mb-2 border-b border-gray-700 pb-1 flex justify-between items-center">
          <span className="flex items-center gap-1"><Database size={10} /> Colony Storage</span>
      </h3>
      
      {resources.length === 0 ? (
          <div className="text-xs text-gray-600 italic text-center py-2">Stockpiles Empty</div>
      ) : (
          <div className="space-y-1.5 max-h-[60vh] overflow-y-auto no-scrollbar">
            {resources.map(([name, count]) => (
              <div key={name} className="flex justify-between items-center group">
                <div className="flex items-center gap-2">
                    <div className="opacity-70 group-hover:opacity-100 transition-opacity">
                        {getIcon(name)}
                    </div>
                    <span className="text-xs text-gray-300 font-medium tracking-tight shadow-black drop-shadow-md">{name}</span>
                </div>
                <span className="text-xs font-mono text-gray-400 group-hover:text-white transition-colors">{count}</span>
              </div>
            ))}
          </div>
      )}
    </div>
  );
};

export default ResourceHUD;
