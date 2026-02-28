import React, { useState } from 'react';
import { Loader2 } from 'lucide-react';

export default function PullToRefresh({ onRefresh, children }) {
  const [refreshing, setRefreshing] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [pullDistance, setPullDistance] = useState(0);

  const handleRefresh = async () => {
    setRefreshing(true);
    await onRefresh();
    setTimeout(() => setRefreshing(false), 500);
  };

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setTouchStart(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (touchStart === 0 || window.scrollY > 0) return;
    
    const touchCurrent = e.touches[0].clientY;
    const distance = touchCurrent - touchStart;
    
    if (distance > 0) {
      setPullDistance(Math.min(distance, 100));
    }
  };

  const handleTouchEnd = async () => {
    if (pullDistance > 60) {
      await handleRefresh();
    }
    setTouchStart(0);
    setPullDistance(0);
  };

  return (
    <div
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      className="min-h-[calc(100vh-4rem)]"
    >
      {/* Pull to refresh indicator */}
      {pullDistance > 0 && (
        <div 
          className="fixed top-16 left-0 right-0 flex justify-center z-50 transition-transform"
          style={{ transform: `translateY(${Math.min(pullDistance - 20, 50)}px)` }}
        >
          <div className="bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
            {refreshing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Refreshing...</span>
              </>
            ) : pullDistance > 60 ? (
              <span className="text-sm">Release to refresh</span>
            ) : (
              <span className="text-sm">Pull to refresh</span>
            )}
          </div>
        </div>
      )}
      
      {children}
    </div>
  );
}