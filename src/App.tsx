import React, { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import Player from './player';
import GameScene from './GameScene';

const App: React.FC = () => {
  const [enableOrbitControls, setEnableOrbitControls] = useState(true);
  const [showInstructions, setShowInstructions] = useState(true);
  
  // 处理玩家瞄准状态变化
  const handleAimingChange = (isAiming: boolean) => {
    setEnableOrbitControls(!isAiming);
  };

  return (
    <div style={{ 
      width: '100vw', 
      height: '100vh', 
      position: 'relative',
      background: 'linear-gradient(135deg, #1a1a2e, #16213e)',
      overflow: 'hidden'
    }}>
      <Canvas
        shadows
        camera={{
          position: [0, 5, 15],
          fov: 75,
          near: 0.1,
          far: 1000
        }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 20, 15]}
          intensity={0.8}
          castShadow
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
        />
        
        {/* 粒子场景 */}
        <GameScene />
        
        {/* 玩家角色 */}
        <Player 
          position={[0, 0, 0]}
          onAimingChange={handleAimingChange}
        />
        
        {/* 轨道控制器 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          enabled={enableOrbitControls}
        />
      </Canvas>
      
      {/* 控制说明 */}
      {showInstructions && (
        <div style={{
          position: 'absolute',
          bottom: '20px',
          left: '20px',
          background: 'rgba(10, 15, 35, 0.7)',
          border: '2px solid #55aaff',
          borderRadius: '10px',
          padding: '15px',
          color: 'white',
          zIndex: 100,
          maxWidth: '300px'
        }}>
          <h3 style={{ color: '#ffaa55', marginBottom: '10px' }}>控制说明</h3>
          <p><strong>WASD</strong>: 移动角色</p>
          <p><strong>鼠标右键</strong>: 瞄准</p>
          <p><strong>鼠标左键</strong>: 射击</p>
          <p><strong>鼠标移动</strong>: 环视场景</p>
          <p><strong>滚轮</strong>: 缩放视角</p>
          <p><strong>空格</strong>: 向上移动</p>
          <p><strong>Shift</strong>: 向下移动</p>
          
          <button 
            onClick={() => setShowInstructions(false)}
            style={{
              marginTop: '10px',
              padding: '5px 10px',
              background: '#ff3366',
              color: 'white',
              border: 'none',
              borderRadius: '5px',
              cursor: 'pointer'
            }}
          >
            关闭说明
          </button>
        </div>
      )}
      
      {/* 标题 */}
      <div style={{
        position: 'absolute',
        top: '20px',
        left: '20px',
        background: 'rgba(10, 15, 35, 0.7)',
        border: '2px solid #ffaa55',
        borderRadius: '10px',
        padding: '15px',
        color: 'white',
        zIndex: 100
      }}>
        <h1 style={{ color: '#ffaa55', fontSize: '24px', marginBottom: '5px' }}>张飞骑士冒险</h1>
        <p style={{ color: '#55aaff', fontSize: '16px' }}>
          在粒子世界中探索，使用你的武器对抗未知的敌人！
        </p>
      </div>
      
      {/* 显示/隐藏说明按钮 */}
      {!showInstructions && (
        <button 
          onClick={() => setShowInstructions(true)}
          style={{
            position: 'absolute',
            bottom: '20px',
            left: '20px',
            padding: '8px 15px',
            background: '#3b7cb1',
            color: 'white',
            border: 'none',
            borderRadius: '5px',
            cursor: 'pointer',
            zIndex: 100
          }}
        >
          显示控制说明
        </button>
      )}
    </div>
  );
};

export default App;
