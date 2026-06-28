import React, { useState } from 'react';
import MainScreen from './pages/MainScreen';
import PurchaseScreen from './pages/PurchaseScreen';
import RecommendScreen from './pages/RecommendScreen';
import './App.css';

function App() {
  const [currentScreen, setCurrentScreen] = useState('main'); // 'main' or 'purchase' or 'recommend'
  const [purchaseRecommend, setPurchaseRecommend] = useState(null);

  const handleBuyClick = () => {
    // Clear any previous recommendation when entering direct purchase
    setPurchaseRecommend(null);
    setCurrentScreen('purchase');
  };

  const handleBackToMain = () => {
    setCurrentScreen('main');
  };

  const handleRecommendClick = () => {
    setCurrentScreen('recommend');
  };

  const goToPurchaseWithRecommend = (recommendation) => {
    setPurchaseRecommend(recommendation || null);
    setCurrentScreen('purchase');
  };

  if (currentScreen === 'purchase') {
    return <PurchaseScreen onBack={handleBackToMain} recommendedCombo={purchaseRecommend} />;
  }

  if (currentScreen === 'recommend') {
    return <RecommendScreen onBack={handleBackToMain} onGoToPurchase={goToPurchaseWithRecommend} />;
  }

  return (
    <MainScreen 
      onBuyClick={handleBuyClick}
      onRecommendClick={handleRecommendClick}
    />
  );
}

export default App;

