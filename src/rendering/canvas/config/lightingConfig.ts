export const lightingConfig = {
  // Base scene
  ambientLevel: 0.4,           
  ambientColor: 0x080814,      
  falloffExponent: 3.5,        
  coreSharpness: 0.06,         

  // Player
  playerRadius: 200,
  playerIntensity: 1.4,
  fovRadius: 1100,
  fovIntensity: 2.5,           
  fovSoftEdge: 8,              

  // Projectiles
  bulletRadius: 80,             
  bulletIntensity: 2.0,         
  bulletSniperRadius: 160,      
  bulletSniperIntensity: 2.5,
  bulletTrailAngle: 50,

  // Grenades
  grenadeRadius: 400,
  grenadeIntensity: 3.0,
  grenadeDecay: 400,
  flashRadius: 1000,
  flashIntensity: 4.0,          
  flashDecay: 800,

  // Impact effects
  deathBurstRadius: 280,
  deathBurstIntensity: 3.5,
  deathBurstDecay: 900,        
  wallHitRadius: 100,
  wallHitIntensity: 2.5,
  wallHitDecay: 300,

  // Last known
  lastKnownRadius: 160,
  lastKnownIntensity: 1.5,
};