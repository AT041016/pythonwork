import { useRef, useState, useEffect } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { EffectComposer, Bloom } from '@react-three/postprocessing';

// 粒子配置类型
interface ParticleConfig {
  star: {
    count: number;
    size: number;
    rotationSpeed: number;
  };
  waterfall: {
    count: number;
    size: number;
    speed: number;
    spread: number;
  };
  fountain: {
    count: number;
    size: number;
    power: number;
    height: number;
  };
}

const GameScene = () => {
  const [particleConfig] = useState<ParticleConfig>({
    star: { count: 2000, size: 0.5, rotationSpeed: 0.0002 },
    waterfall: { count: 1000, size: 1.5, speed: 0.2, spread: 10 },
    fountain: { count: 800, size: 1.8, power: 0.35, height: 15 },
  });
  
  const starsRef = useRef<THREE.Points>(null);
  const waterfallRef = useRef<THREE.Points>(null);
  const fountainRef = useRef<THREE.Points>(null);
  const controlBallRef = useRef<THREE.Mesh>(null);
  
  const { scene } = useThree();
  
  // 创建星空背景
  useEffect(() => {
    const { count } = particleConfig.star;
    const starsGeometry = new THREE.BufferGeometry();
    
    const starsVertices = [];
    for (let i = 0; i < count; i++) {
      const x = THREE.MathUtils.randFloatSpread(200);
      const y = THREE.MathUtils.randFloatSpread(200);
      const z = THREE.MathUtils.randFloatSpread(200);
      starsVertices.push(x, y, z);
    }
    
    starsGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starsVertices, 3));
    if (starsRef.current) {
      starsRef.current.geometry.dispose();
      starsRef.current.geometry = starsGeometry;
    }
  }, [particleConfig.star]);
  
  // 创建粒子瀑布
  useEffect(() => {
    const { count, speed, spread } = particleConfig.waterfall;
    const waterfallGeometry = new THREE.BufferGeometry();
    
    const particles = new Float32Array(count * 3);
    const particleVelocities = new Float32Array(count);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      particles[i3] = (Math.random() - 0.5) * spread; // x
      particles[i3 + 1] = Math.random() * 20; // y
      particles[i3 + 2] = (Math.random() - 0.5) * 5; // z
      
      particleVelocities[i] = Math.random() * speed + speed * 0.5;
    }
    
    waterfallGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    if (waterfallRef.current) {
      waterfallRef.current.userData.velocities = particleVelocities;
      waterfallRef.current.userData.resetY = 20;
      waterfallRef.current.geometry.dispose();
      waterfallRef.current.geometry = waterfallGeometry;
    }
  }, [particleConfig.waterfall]);
  
  // 创建粒子喷泉
  useEffect(() => {
    const { count, power, height } = particleConfig.fountain;
    const fountainGeometry = new THREE.BufferGeometry();
    
    const particles = new Float32Array(count * 3);
    const particleVelocities = new Float32Array(count * 3);
    const startPositions = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      const i3 = i * 3;
      const angle = Math.random() * Math.PI * 2;
      const radius = Math.random() * 2;
      
      // 起始位置
      startPositions[i3] = Math.cos(angle) * radius;
      startPositions[i3 + 1] = 0;
      startPositions[i3 + 2] = Math.sin(angle) * radius;
      
      // 初始位置
      particles[i3] = startPositions[i3];
      particles[i3 + 1] = startPositions[i3 + 1];
      particles[i3 + 2] = startPositions[i3 + 2];
      
      // 初始速度
      const velocityPower = Math.random() * power + power * 0.3;
      particleVelocities[i3] = (Math.random() - 0.5) * 0.2;
      particleVelocities[i3 + 1] = Math.random() * velocityPower + velocityPower * 0.5;
      particleVelocities[i3 + 2] = (Math.random() - 0.5) * 0.2;
    }
    
    fountainGeometry.setAttribute('position', new THREE.BufferAttribute(particles, 3));
    if (fountainRef.current) {
      fountainRef.current.userData = { 
        velocities: particleVelocities, 
        startPositions: startPositions,
        resetHeight: height
      };
      fountainRef.current.geometry.dispose();
      fountainRef.current.geometry = fountainGeometry;
    }
  }, [particleConfig.fountain]);
  
  // 创建环境
  useEffect(() => {
    // 地面
    const groundGeometry = new THREE.PlaneGeometry(100, 100);
    const groundMaterial = new THREE.MeshStandardMaterial({
      color: 0x1a5c1a,
      roughness: 0.8,
      metalness: 0.2
    });
    const ground = new THREE.Mesh(groundGeometry, groundMaterial);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -2;
    ground.receiveShadow = true;
    scene.add(ground);
    
    // 随机建筑
    const buildingMaterial = new THREE.MeshStandardMaterial({
      color: 0x8a6d3b,
      roughness: 0.7,
      metalness: 0.3
    });
    
    for (let i = 0; i < 10; i++) {
      const size = Math.random() * 4 + 2;
      const height = Math.random() * 8 + 4;
      const buildingGeometry = new THREE.BoxGeometry(size, height, size);
      const building = new THREE.Mesh(buildingGeometry, buildingMaterial);
      
      building.position.x = (Math.random() - 0.5) * 80;
      building.position.z = (Math.random() - 0.5) * 80;
      building.position.y = height / 2 - 2;
      building.castShadow = true;
      building.receiveShadow = true;
      
      scene.add(building);
    }
    
    // 中央平台
    const platformGeometry = new THREE.CylinderGeometry(8, 8, 1, 32);
    const platformMaterial = new THREE.MeshStandardMaterial({
      color: 0x7d6608,
      roughness: 0.6,
      metalness: 0.4
    });
    const platform = new THREE.Mesh(platformGeometry, platformMaterial);
    platform.position.y = -1.5;
    platform.receiveShadow = true;
    scene.add(platform);
    
    return () => {
      scene.remove(ground);
      // 清理建筑等...
    };
  }, [scene]);
  
  // 动画更新
  useFrame((state, delta) => {
    // 旋转星空
    if (starsRef.current) {
      starsRef.current.rotation.y += particleConfig.star.rotationSpeed * delta * 60;
    }
    
    // 更新瀑布粒子
    if (waterfallRef.current) {
      const positions = waterfallRef.current.geometry.attributes.position.array;
      const velocities = waterfallRef.current.userData.velocities;
      
      for (let i = 0; i < positions.length; i += 3) {
        const index = i / 3;
        positions[i + 1] -= velocities[index] * delta * 20;
        
        if (positions[i + 1] < -10) {
          positions[i + 1] = waterfallRef.current.userData.resetY;
          positions[i] = (Math.random() - 0.5) * 10;
        }
      }
      
      waterfallRef.current.geometry.attributes.position.needsUpdate = true;
    }
    
    // 更新喷泉粒子
    if (fountainRef.current) {
      const positions = fountainRef.current.geometry.attributes.position.array;
      const velocities = fountainRef.current.userData.velocities;
      const startPositions = fountainRef.current.userData.startPositions;
      
      for (let i = 0; i < positions.length; i += 3) {
        // 应用重力
        velocities[i + 1] -= 0.2 * delta * 20;
    
        // 更新位置
        positions[i] += velocities[i] * delta * 10;
        positions[i + 1] += velocities[i + 1] * delta * 10;
        positions[i + 2] += velocities[i + 2] * delta * 10;
    
        // 重置粒子
        if (positions[i + 1] < 0) {
          positions[i] = startPositions[i];
          positions[i + 1] = startPositions[i + 1];
          positions[i + 2] = startPositions[i + 2];
        
          const velocityPower = Math.random() * particleConfig.fountain.power + particleConfig.fountain.power * 0.3;
          velocities[i] = (Math.random() - 0.5) * 0.2;
          velocities[i + 1] = Math.random() * velocityPower + velocityPower * 0.5;
          velocities[i + 2] = (Math.random() - 0.5) * 0.2;
        }
      }
      
      fountainRef.current.geometry.attributes.position.needsUpdate = true;
    }
    
    // 控制球脉动效果
    if (controlBallRef.current) {
      const scale = 1 + Math.sin(state.clock.elapsedTime * 3) * 0.05;
      controlBallRef.current.scale.set(scale, scale, scale);
    }
  });
  
  return (
    <>
      {/* 星空 */}
      <points ref={starsRef}>
        <pointsMaterial 
          size={particleConfig.star.size} 
          transparent 
          opacity={0.8} 
          color="#ffffff"
        />
      </points>
      
      {/* 瀑布 */}
      <points ref={waterfallRef} position={[0, 10, -5]}>
        <pointsMaterial 
          color={0x55aaff} 
          size={particleConfig.waterfall.size} 
          transparent 
          opacity={0.7} 
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* 喷泉 */}
      <points ref={fountainRef} position={[0, 0, 0]}>
        <pointsMaterial 
          color={0xffaa55} 
          size={particleConfig.fountain.size} 
          transparent 
          opacity={0.8} 
          blending={THREE.AdditiveBlending}
        />
      </points>
      
      {/* 控制球 */}
      <mesh ref={controlBallRef} position={[0, 0, 0]} castShadow>
        <sphereGeometry args={[1.5, 32, 32]} />
        <meshStandardMaterial 
          color={0xff3366}
          emissive={0xff0066}
          emissiveIntensity={0.5}
          roughness={0.3}
          metalness={0.7}
        />
      </mesh>
      
      {/* 后期处理 */}
      <EffectComposer>
        <Bloom 
          intensity={1.5}
          radius={0.4}
          luminanceThreshold={0.85}
          luminanceSmoothing={0.1}
        />
      </EffectComposer>
    </>
  );
};

export default GameScene;
