import { useRef, useState } from 'react';
import { useFrame, useLoader } from '@react-three/fiber';
import * as THREE from 'three';
import { FBXLoader, GLTFLoader, TextGeometry } from 'three/examples/jsm/Addons.js';
import Bullet from './Bullet';


// Boss组件
function Boss(
    {
        playerPosition,
        onPlayerHit
    }: {
        playerPosition: THREE.Vector3;
        onPlayerHit: () => void;
    }
) {
    const fbx = useLoader(FBXLoader, 'Spider.fbx');
    const texture = useLoader(THREE.TextureLoader, 'DefaultMaterial_albedo.png');
    const lineRef = useRef(); // 用于绘制红色实线
    const bossRef = useRef<THREE.Group>(null);


    const bossPositionRef = useRef(new THREE.Vector3(5, 0, 5));
    // const [bossPosition, setBossPosition] = useState(new THREE.Vector3(5, 0, 5)); // Boss初始位置
    const [bullets, setBullets] = useState<{ position: THREE.Vector3; direction: THREE.Vector3; spawnTime: number }[]>([]);
    const lastShootTime = useRef(0); // 记录上次发射子弹的时间
    const [isPaused, setIsPaused] = useState(false); // 控制暂停状态
    const [cooldown, setCooldown] = useState(false); // 控制冷却状态
    const shootCount = useRef(0); // 记录发射子弹的次数
    const [health, setHealth] = useState(100); // Boss的生命值

    const getBossPosition = () => {
        return bossRef.current ?
            bossRef.current.position.clone() :
            new THREE.Vector3(5, 0, 5);
    };


    // Boss移动逻辑
    useFrame((state) => {
        if (!bossRef.current) return;

        const bossPosition = bossRef.current.position;
        if (isPaused && lineRef.current) {
            // 更新红线的几何数据，使其长度覆盖 Boss 和玩家之间的距离
            const points = [bossPosition, playerPosition];
            const geometry = new THREE.BufferGeometry().setFromPoints(points);
            lineRef.current.geometry = geometry;
        }
        // 更新子弹位置
        setBullets((prevBullets) =>
            prevBullets
                .map((bullet) => {
                    if (bullet.position && bullet.direction) {
                        bullet.position.add(bullet.direction.clone().multiplyScalar(0.1)); // 更新位置
                    } else {
                        console.error('子弹数据结构错误:', bullet);
                    }
                    return bullet;
                })
                .filter((bullet) => {
                    const currentTime = performance.now() / 1000; // 获取当前时间（秒）
                    return currentTime - bullet.spawnTime <= 5; // 保留生成时间未超过5秒的子弹
                })
        );
        if (isPaused) return;
        const currentTime = state.clock.getElapsedTime();
        if (currentTime - lastShootTime.current > 2) {
            lastShootTime.current = currentTime;
            if (!cooldown) {
                shootaround();
                shootCount.current += 1; // 增加发射次数
                if (shootCount.current >= 3) {
                    // 达到五次后进入冷却
                    setCooldown(true);
                    shootCount.current = 0; // 重置发射计数
                    setTimeout(() => setCooldown(false), 5000); // 冷却时间为5秒
                }
            } else {
                shootBullet();
            }
        }
        //判断距离，小于某个值，则冲刺
        if (bossPosition.distanceTo(playerPosition) < 1) {
            //暂停一秒，取消所有的动作
            pauseMovement(); // 暂停一秒
        }
        move();
    });

    // Boss发射子弹
    const shootBullet = () => {
        const bossPosition = getBossPosition();
        if (!(playerPosition instanceof THREE.Vector3) || !(bossPosition instanceof THREE.Vector3)) {
            throw new Error('playerPosition 或 bossPosition 不是 THREE.Vector3 类型');
        }
        const direction = new THREE.Vector3().subVectors(playerPosition, bossPosition).normalize();
        const bulletPosition = bossPosition.clone(); // 子弹初始位置
        const spawnTime = performance.now() / 1000; // 记录子弹生成时间
        setBullets((prevBullets) => [
            ...prevBullets,
            { position: bulletPosition.clone(), direction: direction.clone(), spawnTime },
        ]);
    };

    const pauseMovement = () => {
        setIsPaused(true); // 设置暂停状态
        setTimeout(() => {
            setIsPaused(false); // 恢复运动
            jump(); // 在暂停结束后执行 jump
        }, 1000); // 暂停一秒
    };

    const shootaround = () => {
        const bossPosition = getBossPosition();
        if (!(bossPosition instanceof THREE.Vector3)) {
            throw new Error('bossPosition 不是 THREE.Vector3 类型');
        }
        const bulletCount = 60; // 子弹数量
        const angleStep = (2 * Math.PI) / bulletCount; // 每个子弹的角度间隔
        const spawnTime = performance.now() / 1000; // 记录子弹生成时间
        const newBullets = Array.from({ length: bulletCount }, (_, i) => {
            const angle = i * angleStep; // 当前子弹的角度
            const direction = new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)).normalize(); // 计算方向
            const bulletPosition = bossPosition.clone(); // 子弹初始位置
            return { position: bulletPosition, direction, spawnTime };
        });
        setBullets((prevBullets) => [...prevBullets, ...newBullets]); // 添加新子弹到子弹列表
    };

    // Boss移动
    const move = () => {
        if (bossRef.current) {
            const direction = new THREE.Vector3()
                .subVectors(playerPosition, bossRef.current.position)
                .normalize();

            bossRef.current.position.add(direction.multiplyScalar(0.05));

            if (bossRef.current.position.distanceTo(playerPosition) < 1) {
                onPlayerHit();
            }
        }
    };

    //冲刺
    const jump = () => {
        const bossPosition = getBossPosition();
        if (bossRef.current) {
            const direction = new THREE.Vector3().subVectors(playerPosition, bossPosition).normalize();
            bossPosition.add(direction.multiplyScalar(5)); // 缓慢移动
            bossRef.current.position.copy(bossPosition);
            // 检测碰撞
            if (bossPosition.distanceTo(playerPosition) < 1) {
                onPlayerHit(); // 玩家受伤
            }
        }
    }

    const takeDamage = (amount) => {
        setHealth((prevHealth) => Math.max(prevHealth - amount, 0));
    };


    return (
        <group ref={bossRef} >
            <primitive object={fbx} scale={[0.5, 0.5, 0.5]}>
                <meshStandardMaterial map={texture} />
            </primitive>
            {bullets.map((bullet, index) => (
                <Bullet key={index} position={bullet.position} />
            ))}

            {isPaused && (
                <line ref={lineRef}>
                    <bufferGeometry />
                    <lineBasicMaterial color="red" />
                </line>
            )}

            {/* 显示Boss的血量条 */}
            <mesh position={[bossPositionRef.current.x, bossPositionRef.current.y + 2, bossPositionRef.current.z]}>
                <planeGeometry args={[2, 0.2]} />
                <meshBasicMaterial color="red" />
            </mesh>
            <mesh position={[bossPositionRef.current.x - 1 + (health / 100), bossPositionRef.current.y + 2, bossPositionRef.current.z]}>
                <planeGeometry args={[health / 100 * 2, 0.2]} />
                <meshBasicMaterial color="green" />
            </mesh>
        </group>
    );
}

export default Boss;