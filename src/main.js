import * as THREE from '../js/three.module.js';
import {OrbitControls} from '../js/OrbitControls.js';
import {GLTFLoader} from '../js/GLTFLoader.js';

let camera, scene, raycaster, renderer;
let pickedObject = null;
let pickedObjectColor = null;
let animations = [];


const canvas = document.querySelector('#c');
renderer = new THREE.WebGLRenderer({canvas});

scene = new THREE.Scene();
scene.background = new THREE.Color(0x00ffff);

var aspect = window.innerWidth / window.innerHeight;
var d = 50;
camera = new THREE.PerspectiveCamera(40, aspect, 1, 1000 );
camera.position.set(d, d, d);
camera.lookAt( scene.position );

const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.update();

renderer.setSize( window.innerWidth, window.innerHeight );
document.body.appendChild( renderer.domElement );

const material = new THREE.MeshPhongMaterial({color: 0x44aa88});
const dim = 40;
const geometry = new THREE.BoxGeometry(dim, dim/10, dim);
const cube = new THREE.Mesh(geometry, material);

/* const sphereMaterial = new THREE.MeshPhongMaterial({color: 0x884488});
const sphereGeometry = new THREE.SphereGeometry(4);
const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial); */
//sphere.position.set(0,6,0);
scene.add(cube);


document.addEventListener('pointerdown', onPointerDown);

let clock = new THREE.Clock()

const color = 0xFFFFFF;
const intensity = 1;
const light = new THREE.DirectionalLight(color, intensity);
light.position.set(0.5,2,0);
scene.add(light);



const gltfLoader = new GLTFLoader();
const treePath = './assets/tree.gltf';
let treeMixer = new THREE.AnimationMixer(cube);
gltfLoader.load(treePath, (gltf) => {
    const tree = gltf.scene;
    treeMixer = new THREE.AnimationMixer(tree);
    animations = gltf.animations;
   
    tree.position.set(-19,2,-19);
    scene.add(tree);
    
    
});

const rockPath = './assets/rock.gltf';
gltfLoader.load(rockPath, (gltf) => {
    const rock = gltf.scene;
    rock.position.set(0,2,0);
    scene.add(rock);
    
});



raycaster = new THREE.Raycaster();

function onPointerDown( event ) {
    
    const x = ( event.clientX / window.innerWidth ) * 2 - 1;
    const y = ( event.clientY / window.innerHeight ) * -2 + 1;
    const pos = new THREE.Vector2(x,y);

    pick(pos, scene, camera);
    
}

function pick(position, scene, camera) {
       
    raycaster.setFromCamera(position, camera);
    const intersectedObjects = raycaster.intersectObjects(scene.children, true);

    if (intersectedObjects.length) {
        if (pickedObject != intersectedObjects[0].object) {
            if (pickedObject) {
                pickedObject.material.color.set(pickedObjectColor);
            }
            pickedObject = intersectedObjects[0].object;
            pickedObjectColor = pickedObject.material.color.clone();
            pickedObject.material.color.set(0x3345a5);
            playAnimation(pickedObject);
        }
    } else {
        if (pickedObject) {
            pickedObject.material.color.set(pickedObjectColor);
        }
        pickedObject = null;
        pickedObjectColor = null;
    }
    console.log(pickedObject.parent);
    //console.log(intersectedObjects);
}


function resizeRendererToDisplaySize(renderer) {
    const canvas = renderer.domElement;
    const width = canvas.clientWidth;
    const height = canvas.clientHeight;
    const needResize = canvas.width !== width || canvas.height !== height;
    if (needResize) {
        renderer.setSize(width, height, false);
    }
    return needResize;
}

function playAnimation(object) {
    if (object.parent.name === "Tree") {
        const clip = THREE.AnimationClip.findByName( animations, 'Shake');
        let action = treeMixer.clipAction( clip );
        console.log(action);
        action.setLoop(THREE.LoopOnce);
        action.reset();
        action.play();
    }

}

function animate() {
    /* time *= 0.0001;
    cube.rotation.x = time;
    cube.rotation.y = time; */
    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }      
    treeMixer.update(clock.getDelta())
    renderer.render( scene, camera );

    requestAnimationFrame( animate );
    
}
animate();