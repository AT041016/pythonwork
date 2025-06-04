
import React from 'react';

import * as THREE from 'three';

interface BulletProps {
    position: THREE.Vector3;
}

function Bullet({ position }: BulletProps) {
    return (
        <mesh position={[position.x, position.y, position.z]}>
            <sphereGeometry args={[0.2, 0.2, 0.2]} />
            <meshStandardMaterial color="red" />
        </mesh>
    );
}



export default Bullet;
