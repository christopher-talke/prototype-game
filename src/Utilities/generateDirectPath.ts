export function generateDirectPath(sourceCoords: coordinates, targetCoords: coordinates, collisions: CollisionMap) {
    
    let sourceX = Math.floor(sourceCoords.x);
    let sourceY = Math.floor(sourceCoords.y);

    let targetX = Math.floor(targetCoords.x);
    let targetY = Math.floor(targetCoords.y);

    let gapBetweenX = sourceCoords.x - targetX;
    let gapBetweenY = sourceCoords.y - targetY;
    if (gapBetweenX < 0) gapBetweenX = gapBetweenX * -1
    if (gapBetweenY < 0) gapBetweenY = gapBetweenY * -1

    let combined = [];

    let biggestDistance = gapBetweenX > gapBetweenY ? gapBetweenX : gapBetweenY;

    for (let i = 0; i < biggestDistance; i++) {
      let newPositionX = (gapBetweenX / biggestDistance);
      let newPositionY = (gapBetweenY / biggestDistance);

      if (targetX < sourceX) {
  
          if (targetX > sourceX) {
              sourceX = targetX
          }
  
          sourceX = sourceX - newPositionX
      } else {
  
          if (targetX < sourceX) {
              sourceX = targetX
          }
  
          sourceX = sourceX + newPositionX
      }
  
      if (targetY < sourceY) {

          if (targetY > sourceY) {
              sourceY = targetY
          }
  
          sourceY = sourceY - newPositionY
      } else {
          
          if (targetY < sourceY) {
              sourceY = targetY
          }
  
          sourceY = sourceY + newPositionY
      }

      if (collisions && collisions[`${Math.floor(sourceX)},${Math.floor(sourceY)}`]) {
        i = biggestDistance + 1
      } else {
          combined.push({
            x: Math.floor(sourceX),
            y: Math.floor(sourceY)
          })
      }
      
    }

    return combined;
}