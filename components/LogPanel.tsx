
import React, { useEffect, useRef } from 'react';
import { useGame } from '../store/gameStore';

const LogPanel: React.FC = () => {
    const { state } = useGame();
    const { logs } = state;
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (bottomRef.current) {
            bottomRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    return (
        <div className="absolute bottom-4 left-4 w-96 h-48 bg-gray-900/90 border border-gray-700 rounded-lg shadow-xl flex flex-col pointer-events-auto z-[500] backdrop-blur-sm">
            <div className="px-3 py-2 bg-gray-800 border-b border-gray-700 rounded-t-lg flex justify-between items-center">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider">Event Log</span>
                <span className="text-[10px] text-gray-500">{logs.length} events</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 font-mono text-xs space-y-1">
                {logs.length === 0 && <div className="text-gray-600 italic p-2">No events recorded.</div>}
                {logs.map(log => (
                    <div key={log.id} className="flex gap-2 animate-fade-in">
                        <span className="text-gray-600">[{new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]</span>
                        <span className={`
                            ${log.type === 'error' ? 'text-red-400 font-bold' : ''}
                            ${log.type === 'success' ? 'text-green-400' : ''}
                            ${log.type === 'warning' ? 'text-yellow-400' : ''}
                            ${log.type === 'info' ? 'text-gray-300' : ''}
                        `}>
                            {log.message}
                        </span>
                    </div>
                ))}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};

export default LogPanel;
