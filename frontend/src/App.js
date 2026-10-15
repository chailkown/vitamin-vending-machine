import React, { useState, useEffect, useCallback, useRef } from 'react';
import MainScreen from './pages/MainScreen';
import PurchaseScreen from './pages/PurchaseScreen';
import RecommendScreen from './pages/RecommendScreen';
import './App.css';
import { clearKioskSession, watchKioskIdle } from './services/kioskSession';

function App() {
  const [currentScreen, setCurrentScreen] = useState('main'); // 'main' or 'purchase' or 'recommend'
  const [purchaseRecommend, setPurchaseRecommend] = useState(null);
  const [sessionVersion, setSessionVersion] = useState(0);
  const [isOrdering, setIsOrdering] = useState(false);
  const orderingRef = useRef(false);

  const setOrdering = useCallback((busy) => {
    orderingRef.current = busy;
    setIsOrdering(busy);
  }, []);
  const resetKiosk = useCallback(() => {
    if (orderingRef.current) return;
    clearKioskSession(window.sessionStorage);
    setPurchaseRecommend(null);
    setCurrentScreen('main');
    // Remount removes all child QR, detail, cart and temporary receipt state.
    setSessionVersion((value) => value + 1);
  }, []);

  useEffect(() => {
    if (currentScreen === 'main' || isOrdering) return;
    return watchKioskIdle(window, resetKiosk);
  }, [currentScreen, isOrdering, resetKiosk]);
  useEffect(() => {
    if (!isOrdering) return;
    const preventUnload = (event) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', preventUnload);
    return () => window.removeEventListener('beforeunload', preventUnload);
  }, [isOrdering]);

  const handleBuyClick = () => {
    // Clear any previous recommendation when entering direct purchase
    setPurchaseRecommend(null);
    setCurrentScreen('purchase');
  };

  const handleBackToMain = () => {
    resetKiosk();
  };

  const handleRecommendClick = () => {
    setCurrentScreen('recommend');
  };

  const goToPurchaseWithRecommend = (recommendation) => {
    setPurchaseRecommend(recommendation || null);
    setCurrentScreen('purchase');
  };

  if (currentScreen === 'purchase') {
    return <PurchaseScreen key={sessionVersion} onBack={handleBackToMain} onOrderComplete={resetKiosk} onOrderingChange={setOrdering} recommendedCombo={purchaseRecommend} />;
  }

  if (currentScreen === 'recommend') {
    return <RecommendScreen key={sessionVersion} onBack={handleBackToMain} onGoToPurchase={goToPurchaseWithRecommend} />;
  }

  return (
    <MainScreen 
      onBuyClick={handleBuyClick}
      onRecommendClick={handleRecommendClick}
    />
  );
}

export default App;

