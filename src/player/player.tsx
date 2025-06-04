import { forwardRef, useRef, useEffect, useState } from 'react';
import { Group, Mesh, Vector3, MathUtils, Euler } from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';



type BodyPartSize = [
  width: number,
  height: number,
  depth: number,
  widthSegments?: number,
  heightSegments?: number,
  depthSegments?: number
];

interface Bullet {
  id: number;
  position: Vector3;
  direction: Vector3;
  velocity: number;
  lifespan: number;
}

interface PlayerProps {
  position: THREE.Vector3;
  setPosition?: (position: THREE.Vector3) => void;
  onAimingChange?: (isAiming: boolean) => void;
}

const Player = forwardRef<Group, PlayerProps>(({ position, setPosition, onAimingChange }, ref) => {
  const { camera, gl } = useThree();
  const gunRef = useRef<Mesh>(null);
  const leftArmRef = useRef<Mesh>(null);
  const rightArmRef = useRef<Mesh>(null);
  const leftLegRef = useRef<Mesh>(null);
  const rightLegRef = useRef<Mesh>(null);
  const bodyRef = useRef<Mesh>(null);
  const fpsGunRef = useRef<Mesh>(null);
  const headRef = useRef<Mesh>(null);

  const internalRef = useRef<Group>(null);
  const playerRef = ref || internalRef;

  const initialPosition = new Vector3(...position);
  const prevPosition = useRef(new Vector3(...position));

  // 新增：使用 ref 存储内部位置状态
  const internalPosition = useRef(new Vector3(...position));
  // 存储初始 Y 位置（用于跳跃计算）
  const initialY = useRef(position[1]);

  const bodyParts = {
    head: [0.8, 0.8, 0.8] as BodyPartSize,
    body: [0.8, 1.2, 0.4] as BodyPartSize,
    arm: [0.4, 0.8, 0.4] as BodyPartSize,
    leg: [0.4, 0.8, 0.4] as BodyPartSize,
    gun: [0.8, 0.2, 0.1] as BodyPartSize
  };

  const [keys, setKeys] = useState({
    w: false,
    a: false,
    s: false,
    d: false,
    space: false,
    shift: false
  });

  const [isMoving, setIsMoving] = useState(false);
  const [recoilProgress, setRecoilProgress] = useState(0);

  const [bullets, setBullets] = useState<Bullet[]>([]);
  const bulletId = useRef(0);

  const [isAiming, setIsAiming] = useState(false);
  const [isFiring, setIsFiring] = useState(false);
  const lastFireTime = useRef(0);
  const fireRate = 100;

  const savedCameraState = useRef<{
    position: Vector3;
    rotation: Euler;
  } | null>(null);

  const clockRef = useRef({
    move: 0,
    recoil: 0
  });

  // 鼠标控制相关状态
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [mouseX, setMouseX] = useState(0);
  const [mouseY, setMouseY] = useState(0);
  const [rotationX, setRotationX] = useState(0);
  const [rotationY, setRotationY] = useState(0);
  const [initialRotationSet, setInitialRotationSet] = useState(false);

  // 跳跃相关状态
  const [isJumping, setIsJumping] = useState(false);
  const [jumpVelocity, setJumpVelocity] = useState(0);
  const jumpForce = 0.3;
  const gravity = 0.015;

  // 蹲下相关状态
  const [isCrouching, setIsCrouching] = useState(false);
  const crouchSpeedMultiplier = 0.5; // 蹲下时的速度倍率
  const normalSpeed = 0.1;
  const crouchHeight = 0.5; // 蹲下时的高度减少量
  const [originalCameraPositionY, setOriginalCameraPositionY] = useState(0);

  // 相机跟随相关状态
  const [cameraDistance, setCameraDistance] = useState(5); // 相机与角色的距离
  const [minCameraDistance] = useState(3);
  const [maxCameraDistance] = useState(8);
  const [cameraHeight] = useState(1.5); // 相机高度

  // 平滑相机移动
  const cameraTargetPosition = useRef(new Vector3());
  const cameraCurrentPosition = useRef(new Vector3());
  const cameraSmoothing = useRef(0.1); // 平滑系数，值越小越平滑

  // 获取角色前方方向
  const getPlayerForward = () => {
    if (!playerRef || typeof playerRef === "function") return new Vector3(0, 0, -1);
    if (!playerRef.current) return new Vector3(0, 0, -1);

    const forward = new Vector3(0, 0, -1);
    forward.applyQuaternion(playerRef.current.quaternion);
    return forward.normalize();
  };

  useEffect(() => {
    const newPos = new Vector3(...position);
    if (!newPos.equals(internalPosition.current)) {
      internalPosition.current.copy(newPos);
      initialY.current = newPos.y;
      if (internalRef.current) {
        internalRef.current.position.copy(newPos);
      }
    }
  }, [position]);

  // 键盘事件监听
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'w') setKeys((prev) => ({ ...prev, w: true }));
      if (e.key === 'a') setKeys((prev) => ({ ...prev, a: true }));
      if (e.key === 's') setKeys((prev) => ({ ...prev, s: true }));
      if (e.key === 'd') setKeys((prev) => ({ ...prev, d: true }));

      // 空格触发跳跃
      if (e.key === ' ' && !isJumping) {
        setKeys((prev) => ({ ...prev, space: true }));
        setIsJumping(true);
        setJumpVelocity(jumpForce);
      }

      // Shift触发蹲下
      if (e.key === 'Shift') {
        setKeys((prev) => ({ ...prev, shift: true }));
        setIsCrouching(true);

        // 保存原始相机Y位置
        if (!isCrouching && isAiming && camera) {
          setOriginalCameraPositionY(camera.position.y);
        }
      }

      // 鼠标滚轮调整相机距离
      if (e.key === '=' || e.key === '+') {
        setCameraDistance(prev => Math.max(minCameraDistance, prev - 0.5));
      }
      if (e.key === '-' || e.key === '_') {
        setCameraDistance(prev => Math.min(maxCameraDistance, prev + 0.5));
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'w') setKeys((prev) => ({ ...prev, w: false }));
      if (e.key === 'a') setKeys((prev) => ({ ...prev, a: false }));
      if (e.key === 's') setKeys((prev) => ({ ...prev, s: false }));
      if (e.key === 'd') setKeys((prev) => ({ ...prev, d: false }));

      if (e.key === ' ') {
        setKeys((prev) => ({ ...prev, space: false }));
      }

      // Shift释放取消蹲下
      if (e.key === 'Shift') {
        setKeys((prev) => ({ ...prev, shift: false }));
        setIsCrouching(false);
      }
    };

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        setIsFiring(true);
      } else if (e.button === 2) {
        savedCameraState.current = {
          position: camera.position.clone(),
          rotation: new Euler().copy(camera.rotation)
        };
        setIsAiming(true);
      }

      // 鼠标左键按下开始跟踪鼠标移动
      if (e.button === 0) {
        setIsMouseDown(true);
        setMouseX(e.clientX);
        setMouseY(e.clientY);
      }
    };

    const handleMouseUp = (e: MouseEvent) => {
      if (e.button === 0) {
        setIsFiring(false);
      } else if (e.button === 2) {
        setIsAiming(false);
      }

      // 鼠标左键释放停止跟踪鼠标移动
      if (e.button === 0) {
        setIsMouseDown(false);
      }
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (isMouseDown) {
        const deltaX = e.clientX - mouseX;
        const deltaY = e.clientY - mouseY;

        // 更新旋转角度
        setRotationY(rotationY - deltaX * 0.01);
        setRotationX(Math.max(-Math.PI / 2, Math.min(Math.PI / 2, rotationX - deltaY * 0.01)));

        setMouseX(e.clientX);
        setMouseY(e.clientY);
      }
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };

    // 鼠标滚轮事件处理
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!isAiming) { // 只在第三人称视角下允许调整相机距离
        const delta = e.deltaY > 0 ? 0.5 : -0.5;
        setCameraDistance(prev => Math.max(minCameraDistance, Math.min(maxCameraDistance, prev + delta)));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    const canvas = gl.domElement;
    canvas.addEventListener('mousedown', handleMouseDown);
    canvas.addEventListener('mouseup', handleMouseUp);
    canvas.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('wheel', handleWheel);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
      canvas.removeEventListener('mousedown', handleMouseDown);
      canvas.removeEventListener('mouseup', handleMouseUp);
      canvas.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('wheel', handleWheel);
    };
  }, [gl, isMouseDown, mouseX, mouseY, rotationX, rotationY, isJumping, isCrouching, camera, isAiming, minCameraDistance, maxCameraDistance]);

  // 瞄准状态变化回调
  useEffect(() => {
    if (onAimingChange) {
      onAimingChange(isAiming);
    }
  }, [isAiming, onAimingChange]);

  // 第一人称瞄准模式下更新相机位置
  useEffect(() => {
    if (isAiming && playerRef && typeof playerRef !== "function" && playerRef.current) {
      const headPosition = playerRef.current.position.clone().add(new Vector3(0, 0.9, 0));

      // 蹲下状态下调整相机高度
      if (isCrouching && originalCameraPositionY !== 0) {
        camera.position.y = originalCameraPositionY - crouchHeight;
      } else {
        camera.position.copy(headPosition);
      }

      // 设置相机旋转，确保画面是正的
      camera.rotation.set(rotationX, rotationY, 0);
    } else if (!isAiming && savedCameraState.current) {
      // 恢复相机位置
      camera.position.copy(savedCameraState.current.position);
      camera.rotation.copy(savedCameraState.current.rotation);
      savedCameraState.current = null;
    }
  }, [isAiming, camera, isCrouching, originalCameraPositionY, rotationX, rotationY]);

  // 动画帧更新
  useFrame(({ clock }, delta) => {
    let playerGroup: Group | null = null;

    if (typeof playerRef === 'function') {
    } else if (playerRef && 'current' in playerRef) {
      playerGroup = playerRef.current;
    }

    if (!playerGroup) return;

    // 设置初始视角，固定在子弹射击方向
    if (!initialRotationSet) {
      playerGroup.rotation.y = rotationY;
      setInitialRotationSet(true);
    }

    // 计算当前移动速度（蹲下时减速）
    const speed = isCrouching ? normalSpeed * crouchSpeedMultiplier : normalSpeed;

    const moving = keys.w || keys.a || keys.s || keys.d;
    setIsMoving(moving);

    // 获取角色前方方向
    const forward = getPlayerForward();

    // 基于角色朝向的移动方向
    const right = new Vector3();
    right.crossVectors(new Vector3(0, 1, 0), forward).normalize();

    //更新内部位置引用
    const currentPosition = internalPosition.current;

    // 保存移动前的Y值（用于跳跃检测）
    const prevY = currentPosition.y;

    // // 水平移动角色
    // if (keys.w) playerGroup.position.add(forward.clone().multiplyScalar(speed));
    // if (keys.s) playerGroup.position.add(forward.clone().multiplyScalar(-speed));
    // if (keys.a) playerGroup.position.add(right.clone().multiplyScalar(speed));
    // if (keys.d) playerGroup.position.add(right.clone().multiplyScalar(-speed));


    // // 处理跳跃
    // if (isJumping) {
    //   // 应用重力
    //   setJumpVelocity(jumpVelocity - gravity);
    //   playerGroup.position.y += jumpVelocity;

    //   // 检测是否落地
    //   if (playerGroup.position.y <= initialPosition.y) {
    //     playerGroup.position.y = initialPosition.y;
    //     setIsJumping(false);
    //     setJumpVelocity(0);
    //   }
    // }

    // 保存移动前的值用于比较
    const prevPos = internalPosition.current.clone();

    // 移动逻辑（更新 internalPosition）
    if (keys.w) internalPosition.current.add(forward.clone().multiplyScalar(speed));
    if (keys.s) internalPosition.current.add(forward.clone().multiplyScalar(-speed));
    if (keys.a) internalPosition.current.add(right.clone().multiplyScalar(speed));
    if (keys.d) internalPosition.current.add(right.clone().multiplyScalar(-speed));

    // 更新组位置
    playerGroup.position.copy(internalPosition.current);

    // 处理跳跃
    if (isJumping) {
      internalPosition.current.y += jumpVelocity;
      playerGroup.position.y = internalPosition.current.y;

      // 落地检测
      if (internalPosition.current.y <= initialY.current) {
        internalPosition.current.y = initialY.current;
        playerGroup.position.y = initialY.current;
        setIsJumping(false);
        setJumpVelocity(0);
      }
    }

    // 新增：位置变化时同步到外部
    if (setPosition && !prevPos.equals(internalPosition.current)) {
      setPosition(internalPosition.current.clone());
    }

    // 更新 prevPosition 为当前帧的位置
    prevPosition.current.copy(internalPosition.current);

    // 蹲下效果
    if (bodyRef.current) {
      if (isCrouching) {
        // 降低身体高度
        bodyRef.current.scale.y = 0.7;
        bodyRef.current.position.y = -0.3;

        // 调整手臂和腿部位置
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.position.y = -0.2;
          rightArmRef.current.position.y = -0.2;
        }

        if (leftLegRef.current && rightLegRef.current) {
          leftLegRef.current.position.y = -0.6;
          rightLegRef.current.position.y = -0.6;
        }
      } else {
        // 恢复正常高度
        bodyRef.current.scale.y = 1;
        bodyRef.current.position.y = 0;

        // 恢复手臂和腿部位置
        if (leftArmRef.current && rightArmRef.current) {
          leftArmRef.current.position.y = 0;
          rightArmRef.current.position.y = 0;
        }

        if (leftLegRef.current && rightLegRef.current) {
          leftLegRef.current.position.y = -0.9;
          rightLegRef.current.position.y = -0.9;
        }
      }
    }

    // 更新角色旋转（鼠标控制）
    playerGroup.rotation.y = rotationY;

    // 第一人称模式下，相机仰角控制
    if (isAiming) {
      camera.rotation.x = rotationX;
    } else {
      // 第三人称模式下，相机围绕角色旋转
      const targetPosition = playerGroup.position.clone();

      // 计算相机目标位置
      const offset = new Vector3();
      offset.x = Math.sin(rotationY) * cameraDistance;
      offset.z = Math.cos(rotationY) * cameraDistance;
      offset.y = cameraHeight + (isCrouching ? -crouchHeight / 2 : 0);

      cameraTargetPosition.current.copy(targetPosition).add(offset);

      // 平滑相机移动
      cameraCurrentPosition.current.lerp(cameraTargetPosition.current, cameraSmoothing.current);
      camera.position.copy(cameraCurrentPosition.current);

      // 让相机始终看向角色
      camera.lookAt(targetPosition);
    }

    if (gunRef.current) {
      const time = clock.getElapsedTime();
      gunRef.current.position.y = Math.sin(time * 2) * 0.02;

      // 蹲下时调整枪的位置
      if (isCrouching) {
        gunRef.current.position.y = -0.6;
      }
    }

    if (recoilProgress > 0) {
      const newRecoil = Math.max(0, recoilProgress - delta * 10);
      setRecoilProgress(newRecoil);

      if (gunRef.current) {
        const recoilAmount = Math.sin(recoilProgress * Math.PI) * 0.3;
        gunRef.current.position.z = 0.2 - recoilAmount;
        gunRef.current.rotation.x = MathUtils.degToRad(recoilAmount * 30);
      }

      if (fpsGunRef.current) {
        const recoilAmount = Math.sin(recoilProgress * Math.PI) * 0.1;
        fpsGunRef.current.position.y = 0.2 - recoilAmount;
        fpsGunRef.current.rotation.x = MathUtils.degToRad(recoilAmount * 15);
      }
    }

    clockRef.current.move += delta;
    const moveTime = clockRef.current.move;

    if (leftArmRef.current && rightArmRef.current) {
      const armSwing = isMoving ? Math.sin(moveTime * 8) * 0.3 : 0;
      leftArmRef.current.rotation.x = armSwing;

      // 修改持枪手臂的旋转角度，使其向上抬起
      rightArmRef.current.rotation.x = -armSwing + 0.5;
      rightArmRef.current.rotation.z = MathUtils.degToRad(-20);

      // 蹲下时调整手臂角度
      if (isCrouching) {
        leftArmRef.current.rotation.x = MathUtils.degToRad(-30);
        rightArmRef.current.rotation.x = MathUtils.degToRad(-20);
      }
    }

    if (leftLegRef.current && rightLegRef.current) {
      const legSwing = isMoving ? Math.sin(moveTime * 8) * 0.3 : 0;
      leftLegRef.current.rotation.x = legSwing;
      rightLegRef.current.rotation.x = -legSwing;

      // 蹲下时调整腿部角度
      if (isCrouching) {
        leftLegRef.current.rotation.x = MathUtils.degToRad(45);
        rightLegRef.current.rotation.x = MathUtils.degToRad(45);
      }
    }

    if (bodyRef.current) {
      const floatAmount = isMoving ? Math.sin(moveTime * 8) * 0.02 : 0;
      bodyRef.current.position.y = floatAmount;
    }

    // 更新子弹位置
    setBullets((prev) =>
      prev
        .map((bullet) => {
          const newPos = bullet.position.clone().add(
            bullet.direction.clone().multiplyScalar(bullet.velocity * delta)
          );
          return {
            ...bullet,
            position: newPos,
            lifespan: bullet.lifespan - delta
          };
        })
        .filter((bullet) => bullet.lifespan > 0)
    );

    // 处理连续射击
    const currentTime = performance.now();
    if (isFiring && currentTime - lastFireTime.current > fireRate) {
      lastFireTime.current = currentTime;
      setRecoilProgress(1);

      let worldPosition: Vector3;
      let direction: Vector3;

      if (isAiming) {
        // 第一人称：从相机位置发射，方向为相机前方
        worldPosition = camera.position.clone();
        direction = new Vector3(0, 0, -1);
        direction.applyQuaternion(camera.quaternion);
      } else {
        // 第三人称：从枪口位置发射，方向为角色前方
        worldPosition = new Vector3();
        if (gunRef.current) {
          gunRef.current.getWorldPosition(worldPosition);
        } else {
          worldPosition = camera.position.clone();
        }
        direction = getPlayerForward();
      }

      // 添加子弹
      setBullets((prev) => [
        ...prev,
        {
          id: bulletId.current++,
          position: worldPosition.clone(),
          direction: direction.clone(),
          velocity: 20,
          lifespan: 1.5
        }
      ]);
    }
  });

  return (
    <>
      {/* 准星 - 只在瞄准或射击时显示 */}
      {(isAiming || isFiring) && (
        <Html center>
          <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 1000
          }}>
            <div style={{
              width: '30px',
              height: '30px',
              position: 'relative'
            }}>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '0',
                width: '100%',
                height: '2px',
                background: '#ff0000',
                transform: 'translateY(-50%)'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '0',
                left: '50%',
                width: '2px',
                height: '100%',
                background: '#ff0000',
                transform: 'translateX(-50%)'
              }}></div>
              <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                width: '4px',
                height: '4px',
                background: '#ff0000',
                borderRadius: '50%',
                transform: 'translate(-50%, -50%)'
              }}></div>
            </div>
          </div>
        </Html>
      )}

      {/* 第一人称视角下的枪模型 */}
      {isAiming && (
        <group>
          <mesh
            ref={fpsGunRef}
            position={[0.4, -0.4, -1]}
            rotation={[Math.PI / 8, 0, MathUtils.degToRad(-5)]}
          >
            <mesh position={[0.1, 0, 0]}>
              <boxGeometry args={[0.7, 0.15, 0.05]} />
              <meshStandardMaterial color="#444" />
            </mesh>

            <mesh position={[0.45, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
              <meshStandardMaterial color="#555" />
            </mesh>

            <mesh position={[-0.2, 0, 0]}>
              <boxGeometry args={[0.2, 0.15, 0.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>

            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.15, 0.15, 0.05]} />
              <meshStandardMaterial color="#666" />
            </mesh>

            <mesh position={[0.2, -0.05, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.06, 8]} />
              <meshStandardMaterial color="#555" />
            </mesh>

            {isFiring && (
              <mesh position={[0.85, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.06, 0.4, 8, 1]} />
                <meshStandardMaterial
                  color="#ff8800"
                  emissive="#ff5500"
                  emissiveIntensity={2}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            )}

            <group position={[-0.1, -0.1, 0.05]} rotation={[0, 0, MathUtils.degToRad(-20)]}>
              <mesh position={[0, 0, 0]}>
                <boxGeometry args={[0.15, 0.1, 0.15]} />
                <meshStandardMaterial color="#f0c090" />
              </mesh>

              <mesh position={[-0.08, 0.06, 0.05]} rotation={[0, 0, MathUtils.degToRad(25)]}>
                <boxGeometry args={[0.05, 0.1, 0.05]} />
                <meshStandardMaterial color="#f0c090" />
              </mesh>

              <mesh position={[0.05, 0.06, 0.08]} rotation={[0, 0, MathUtils.degToRad(5)]}>
                <boxGeometry args={[0.05, 0.12, 0.05]} />
                <meshStandardMaterial color="#f0c090" />
              </mesh>

              <mesh position={[0.05, 0.06, -0.02]} rotation={[0, 0, MathUtils.degToRad(5)]}>
                <boxGeometry args={[0.05, 0.12, 0.05]} />
                <meshStandardMaterial color="#f0c090" />
              </mesh>
            </group>
          </mesh>
        </group>
      )}

      <group
        ref={playerRef}
        // position={initialPosition.toArray()}
        position={internalPosition.current.toArray()}
        visible={!isAiming}>
        {/* 头部 */}
        <mesh ref={headRef} position={[0, 0.9, 0]}>
          <boxGeometry args={bodyParts.head} />
          <meshStandardMaterial color="#6ca0c2" />
          {/* 黑色面作为前方 */}
          <mesh position={[0, 0, 0.41]}>
            <planeGeometry args={[0.6, 0.6] as [number, number]} />
            <meshStandardMaterial color="black" side={2} />
          </mesh>

          {/* 蹲下时调整头部位置 */}
          {isCrouching && (
            <mesh position={[0, -0.3, 0]}>
              <boxGeometry args={[0.8, 0.8, 0.8]} />
              <meshStandardMaterial color="#6ca0c2" transparent opacity={0.3} />
            </mesh>
          )}
        </mesh>

        {/* 身体 */}
        <mesh ref={bodyRef} position={[0, 0, 0]}>
          <boxGeometry args={bodyParts.body} />
          <meshStandardMaterial color="#3b7cb1" />
          <mesh position={[0, -0.1, 0.21]}>
            <boxGeometry args={[0.7, 0.3, 0.1] as BodyPartSize} />
            <meshStandardMaterial color="#2d6a9a" />
          </mesh>
        </mesh>

        {/* 左手臂 */}
        <mesh ref={leftArmRef} position={[-0.6, 0, 0]}>
          <boxGeometry args={bodyParts.arm} />
          <meshStandardMaterial color="#6ca0c2" />
        </mesh>

        {/* 右手臂 - 持枪手臂 */}
        <group position={[0.6, 0, 0]}>
          <mesh ref={rightArmRef}>
            <boxGeometry args={bodyParts.arm} />
            <meshStandardMaterial color="#6ca0c2" />
          </mesh>

          <mesh
            ref={gunRef}
            position={[0.3, -0.7, 0.1]}
            rotation={[0, Math.PI / 2, Math.PI / 2]}
          >
            <mesh position={[0.1, 0, 0]}>
              <boxGeometry args={[0.7, 0.15, 0.05]} />
              <meshStandardMaterial color="#444" />
            </mesh>

            <mesh position={[0.45, 0, 0]}>
              <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
              <meshStandardMaterial color="#555" />
            </mesh>

            <mesh position={[-0.2, 0, 0]}>
              <boxGeometry args={[0.2, 0.15, 0.1]} />
              <meshStandardMaterial color="#333" />
            </mesh>

            <mesh position={[0, -0.1, 0]}>
              <boxGeometry args={[0.15, 0.15, 0.05]} />
              <meshStandardMaterial color="#666" />
            </mesh>

            <mesh position={[0.2, -0.05, 0]}>
              <cylinderGeometry args={[0.05, 0.05, 0.06, 8]} />
              <meshStandardMaterial color="#555" />
            </mesh>

            {isFiring && !isAiming && (
              <mesh position={[0.85, 0, 0]}>
                <cylinderGeometry args={[0.1, 0.06, 0.4, 8, 1]} />
                <meshStandardMaterial
                  color="#ff8800"
                  emissive="#ff5500"
                  emissiveIntensity={2}
                  transparent
                  opacity={0.7}
                />
              </mesh>
            )}
          </mesh>
        </group>

        {/* 左腿 */}
        <mesh ref={leftLegRef} position={[-0.2, -0.9, 0]}>
          <boxGeometry args={bodyParts.leg} />
          <meshStandardMaterial color="#3b7cb1" />
        </mesh>

        {/* 右腿 */}
        <mesh ref={rightLegRef} position={[0.2, -0.9, 0]}>
          <boxGeometry args={bodyParts.leg} />
          <meshStandardMaterial color="#3b7cb1" />
        </mesh>
      </group>

      {/* 渲染所有子弹 */}
      {bullets.map((bullet) => (
        <group key={bullet.id} position={bullet.position.toArray()}>
          <mesh>
            <sphereGeometry args={[0.1, 8, 8]} />
            <meshStandardMaterial
              color="#ff0000"
              emissive="#ff5500"
              emissiveIntensity={1}
            />
          </mesh>
          <mesh position={bullet.direction.clone().multiplyScalar(-0.1).setY(0)}>
            <cylinderGeometry args={[0.02, 0.02, 0.2, 8]} />
            <meshStandardMaterial
              color="#ff8800"
              emissive="#ff5500"
              emissiveIntensity={1}
              transparent
              opacity={0.7}
            />
          </mesh>
        </group>
      ))}
    </>
  );
});

export default Player;  
