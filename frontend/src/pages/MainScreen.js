import React, { useState, useEffect } from 'react';
import '../styles/MainScreen.css';

export default function MainScreen({ onBuyClick, onRecommendClick }) {
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date) => {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  return (
    <div className="main-screen">
      {/* 헤더 */}
      <div className="header">
        <div className="logo-icon">💊</div>
        <h1 className="title">영양제 자판기</h1>
        <p className="subtitle">당신의 건강을 위한 맞춤형 비타민</p>
      </div>

      {/* 메인 컨텐츠 */}
      <div className="main-content">
        {/* 버튼 영역 */}
        <div className="button-container">
          {/* 직접 선택 버튼 */}
          <button className="main-btn purchase-btn" onClick={onBuyClick}>
            <div className="btn-content">
              <div className="btn-label">직접 선택</div>
              <div className="btn-description">원하는 영양제를 선택해 무료로 받기</div>
            </div>
            <div className="btn-icon">🛒</div>
          </button>

          {/* 맞춤형 추천 버튼 */}
          <button className="main-btn recommend-btn" onClick={onRecommendClick}>
            <div className="btn-content">
              <div className="btn-label">맞춤형 추천</div>
              <div className="btn-description">당신에게 필요한 영양제 추천받기</div>
            </div>
            <div className="btn-icon">💚</div>
          </button>
        </div>
      </div>
    </div>
  );
}
