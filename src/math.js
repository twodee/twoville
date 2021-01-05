// --------------------------------------------------------------------------- 

export function distancePointLine(point, line) {
  let diff = [
    point[0] - line.point[0],
    point[1] - line.point[1],
  ];
  const magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
  diff[0] /= magnitude;
  diff[1] /= magnitude;
  let radians = Math.acos(line.axis[0] * diff[0] + line.axis[1] * diff[1]);
  return magnitude * Math.sin(radians);
}

// --------------------------------------------------------------------------- 

export function mirrorPointLine(point, line) {
  const normal = [
    line.axis[0],
    line.axis[1],
  ];

  const magnitude = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1]);
  normal[0] /= magnitude;
  normal[1] /= magnitude;

  const diff = [
    line.point[0] - point[0],
    line.point[1] - point[1],
  ];

  const length = diff[0] * normal[0] + diff[1] * normal[1];

  normal[0] = normal[0] * length * 2 - diff[0];
  normal[1] = normal[1] * length * 2 - diff[1];

  const reflection = [
    line.point[0] - normal[0],
    line.point[1] - normal[1]
  ];

  return reflection;
}

// --------------------------------------------------------------------------- 

