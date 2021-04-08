import * as THREE from '../js/three.module.js';
import {OrbitControls} from '../js/OrbitControls.js';
import {GLTFLoader} from '../js/GLTFLoader.js';
import {BufferGeometryUtils} from '../js/BufferGeometryUtils.js';

let renderer, scene, camera, raycaster, light, mixer;
let animations = new Map();
let models = new Map();
let clock = new THREE.Clock();

/*
-------------------------------------
General code to setup the environment
-------------------------------------
*/
const canvas = document.querySelector('#c');
renderer = new THREE.WebGLRenderer({canvas});
renderer.setSize( window.innerWidth, window.innerHeight );
renderer.shadowMap.enabled = true;
renderer.shadowMapSoft = true;
document.body.appendChild( renderer.domElement );

scene = new THREE.Scene();

let aspect = window.innerWidth / window.innerHeight;
let cameraDist = 40;
camera = new THREE.PerspectiveCamera(cameraDist, aspect, 1, 1000 );
camera.position.set(-cameraDist, cameraDist, -cameraDist);
camera.lookAt( scene.position );

raycaster = new THREE.Raycaster();

/*
----------------------
Lighting Configuration
----------------------
*/

const dayColor = 0xFFFFFF;
const nightColor = 0xdde3eb;
const dayIntensity = 1;
const nightIntensity = 0.6;
const daylight = new THREE.DirectionalLight(dayColor, dayIntensity);
const nightlight = new THREE.DirectionalLight(nightColor, nightIntensity);

configureLight(daylight);
configureLight(nightlight);

daylight.position.set(-50,60,20);
nightlight.position.set(40,60,-40);

let isDaytime = true;
light = daylight;
changeToDay();


const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// Functions for this section:
function configureLight(light) {
    const d = 50;
    light.castShadow = true;
    light.shadow.camera.near = 0;
    light.shadow.camera.far = 500;
    light.shadow.camera.left = -d;
    light.shadow.camera.right = d;
    light.shadow.camera.top = d;
    light.shadow.camera.bottom = -d;
    light.shadow.mapSize.width = 4096;
    light.shadow.mapSize.height = 4096;
}

/*
-----------------------------
Loading and Setting up Meshes
-----------------------------
*/

await loadModels();

const landMaterial = new THREE.MeshPhongMaterial({color: 0x44aa88});
const dim = 40;
const geometry = new THREE.BoxGeometry(dim, dim/20, dim);
const base = new THREE.Mesh(geometry, landMaterial);
base.receiveShadow = true;
base.position.y = -dim/20;
scene.add(base);


const elements = {
    LAND: 0,
    WATER: 1,
    TREE: 2,
    ROCK: 3,
}
let blueprint = generateSampleBlueprint(dim);
addObjectsFromBlueprint(scene, blueprint);


// Functions for this section:
async function loadModels() {
    const loader = new GLTFLoader();

    const [treeData, rockData] = await Promise.all([
        loader.loadAsync("./assets/tree.glb"),
        loader.loadAsync("./assets/rock.glb"),
    ]);

    treeData.scene.children[2].children[0].castShadow = true;
    //treeData.scene.children[2].children[0].receiveShadow = true;

    treeData.scene.children[2].children[1].castShadow = true;
    //treeData.scene.children[2].children[1].receiveShadow = true;

    rockData.scene.children[2].castShadow = true;
    //rockData.scene.children[2].receiveShadow = true;


    models.set("Tree", treeData.scene.children[2]);
    models.set("Rock", rockData.scene.children[2]);

    animations.set("Tree", treeData.animations);
    
}

function generateSampleBlueprint(dim) {

    let blueprint = new Array(dim);
    for (let i = 0; i < dim; i++) {
        blueprint[i] = new Array(dim);
    }

    //Creates a blueprint with dimension 40 in mind.
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {
            
            if (j >= 28 && j <= 35) {
                blueprint[i][j] = elements.WATER;
            } else if (i >= 22) {
                if (i % 8 == 0 && j % 4 == 0) {
                    blueprint[i][j] = elements.TREE;
                } else if (i % 8 == 4 && j % 4 == 2) {
                    blueprint[i][j] = elements.TREE;
                }
            } else {
                blueprint[i][j] = elements.LAND;
            }
        }
    }

    for (let i = 0; i < 15; i++) {
        let r = Math.floor(Math.random() * 20 + 1);
        let c = Math.floor(Math.random() * 26 + 1);
        blueprint[r][c] = elements.ROCK;
    }

    return blueprint;
    
}

function addObjectsFromBlueprint(scene, blueprint) {
    let dim = blueprint.length;
    
    fillTerrain(scene, blueprint);
    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {

            if (blueprint[i][j] == elements.TREE) {
                let tree = models.get("Tree").clone();
                tree.position.set(i-19,1,j-19);
                tree.rotateY(THREE.MathUtils.randFloat(0, 2*Math.PI));
                scene.add(tree);
            } else if (blueprint[i][j] == elements.ROCK) {
                let rock = models.get("Rock").clone();
                rock.position.set(i-19,1,j-19);
                rock.rotateY(THREE.MathUtils.randFloat(0, 2*Math.PI));
                rock.scale.set(Math.random() * 0.4 + 0.8, Math.random() * 0.4 + 0.8, Math.random() * 0.4 + 0.8);
                scene.add(rock);
            }
            
        }
    }
}

function fillTerrain(scene, blueprint) {
    let waterGeometries = [];
    let landGeometries = [];

    let waterGeometry = new THREE.PlaneGeometry(1, 1);
    let waterSideGeometry = new THREE.PlaneGeometry(1, 1.8);
    let landGeometry = new THREE.BoxGeometry(1, 2, 1);

    const waterMaterial = new THREE.MeshPhongMaterial({color: 0x006dcc, opacity: 0.75, transparent: true, side: THREE.DoubleSide});

    for (let i = 0; i < dim; i++) {
        for (let j = 0; j < dim; j++) {

            if (blueprint[i][j] == elements.WATER) {
                
                if (i == 0) {
                    waterSideGeometry.rotateY(Math.PI/2);
                    waterSideGeometry.translate(i - 20, -0.1, j - 19.5);
                    waterGeometries.push(waterSideGeometry.clone());
                    waterSideGeometry.translate(-i + 20, 0.1, -j + 19.5);
                    waterSideGeometry.rotateY(-Math.PI/2);
                } else if (i == dim-1) {
                    waterSideGeometry.rotateY(-Math.PI/2);
                    waterSideGeometry.translate(i - 19, -0.1, j - 19.5);
                    waterGeometries.push(waterSideGeometry.clone());
                    waterSideGeometry.translate(-i + 19, 0.1, -j + 19.5);
                    waterSideGeometry.rotateY(Math.PI/2);
                }

                waterGeometry.rotateX(-Math.PI/2);
                waterGeometry.translate(i - 19.5, 0.8, j - 19.5);
                waterGeometries.push(waterGeometry.clone());
                waterGeometry.translate(-i + 19.5, -0.8, -j + 19.5);
                waterGeometry.rotateX(Math.PI/2);

            } else {
                
                landGeometry.translate(i - 19.5, 0, j - 19.5);
                landGeometries.push(landGeometry.clone());
                landGeometry.translate(-i + 19.5, 0, -j + 19.5);
            }
        }
    }

    let mergedWaterGeometry = BufferGeometryUtils.mergeBufferGeometries(waterGeometries, false);
    let mergedLandGeometry = BufferGeometryUtils.mergeBufferGeometries(landGeometries, false);
    

    const water = new THREE.Mesh(mergedWaterGeometry, waterMaterial);
    water.receiveShadow = true;
    const land = new THREE.Mesh(mergedLandGeometry, landMaterial);
    land.receiveShadow = true;

    scene.add(water);
    scene.add(land);
}


/*
-----------------------
Enabling Interactivity:

Camera~
-Hold left click and move mouse to rotate around the center of the screen.
-Scroll to zoom relative to the center of screen.
-Hold shift and left click to translate the scene.

Other~
-Click a tree or rock to see a small animation.
-Press the spacebar to toggle between daytime and nighttime.
------------------------
*/


const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0, 0);
controls.update();

document.addEventListener('pointerdown', onPointerDown);
document.addEventListener('keydown', onKeyDown);


//Functions for this section:
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
        
        let pickedObject = intersectedObjects[0].object;
        if (pickedObject.parent.name == "Tree") {
            pickedObject = pickedObject.parent;
        }
            
        playAnimation(pickedObject);
    } 

}

function playAnimation(object) {
    if (typeof mixer !== "undefined") {
        mixer.stopAllAction();
    }
    mixer = new THREE.AnimationMixer(object);
    if (object.name === "Tree") {
        const clip = THREE.AnimationClip.findByName( animations.get("Tree"), 'Shake');
        let action = mixer.clipAction( clip );
        
        action.setLoop(THREE.LoopOnce);
        action.reset();
        action.play();
    } else if (object.name === "Rock") {
    
        let times = [0,0.2,0.3,0.4, 0.6];
        let positions = [object.position.y, object.position.y + 3, object.position.y + 4, object.position.y + 3, object.position.y];
        let posTrack = new THREE.VectorKeyframeTrack('.position[y]', times, positions);
        const clip = new THREE.AnimationClip(null, 0.6, [posTrack], THREE.InterpolateSmooth);
        let action = mixer.clipAction( clip );

        action.setLoop(THREE.LoopOnce);
        action.reset();
        action.play();
    }

}

function onKeyDown( event ) {
    if (event.key == " ") {
        if (isDaytime) {
            changeToNight();
        } else {
            changeToDay(); 
        }
        isDaytime = !isDaytime;
    }
}

function changeToDay() {
    scene.background = new THREE.Color(0x00ffff);
    scene.remove(light);
    light = daylight;
    scene.add(light);
}

function changeToNight() {
    scene.background = new THREE.Color(0x0c1445); 
    scene.remove(light);
    light = nightlight;
    scene.add(light);
}

/*
--------------
Rendering Loop
--------------
*/

animate();


function animate() {

    if (resizeRendererToDisplaySize(renderer)) {
        const canvas = renderer.domElement;
        camera.aspect = canvas.clientWidth / canvas.clientHeight;
        camera.updateProjectionMatrix();
    }      
    if (typeof mixer !== "undefined") {
        mixer.update(clock.getDelta());
    }
    renderer.render( scene, camera );

    requestAnimationFrame( animate );
    
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

