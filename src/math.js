// --------------------------------------------------------------------------- 

export function distancePointPoint(a, b) {
  let diff = [
    a[0] - b[0],
    a[1] - b[1],
  ];
  const magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
  return magnitude;
}

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

export function clamp(x, a, b) {
  if (x < a) {
    return a;
  } else if (x > b) {
    return b;
  } else {
    return x;
  }
}

// --------------------------------------------------------------------------- 

export function unitVectorBetween(a, b) {
  let diff = [
    b[0] - a[0],
    b[1] - a[1],
  ];
  const magnitude = Math.sqrt(diff[0] * diff[0] + diff[1] * diff[1]);
  return [
    diff[0] / magnitude,
    diff[1] / magnitude,
  ];
}

// --------------------------------------------------------------------------- 

export function halfwayVector(a, b) {
  const halfway = [a[0] + b[0], a[1] + b[1]];
  const magnitude = Math.sqrt(halfway[0] * halfway[0] + halfway[1] * halfway[1]);
  return [
    halfway[0] / magnitude,
    halfway[1] / magnitude,
  ];
}

// --------------------------------------------------------------------------- 

export function rotateVector(vector, degrees) {
  const radians = degrees * Math.PI / 180;
  return [
    vector[0] * Math.cos(radians) - vector[1] * Math.sin(radians), 
    vector[0] * Math.sin(radians) + vector[1] * Math.cos(radians), 
  ];
}

// --------------------------------------------------------------------------- 

export function isLeftPolygon(positions) {
	let signedArea = 0;
	for (let i = 0; i < positions.length; ++i) {
		const a = positions[i];
		const b = positions[(i + 1) % positions.length];
		signedArea += (b[0] - a[0]) * (b[1] + a[1]);
	}
	return signedArea < 0;
}

// --------------------------------------------------------------------------- 

export function isLeftTurn(a, b, c) {
  const aToB = [b[0] - a[0], b[1] - a[1]];
  const aToC = [c[0] - a[0], c[1] - a[1]];
	const area = aToB[0] * aToC[1] - aToB[1] * aToC[0];
	return area < 0;
}

// --------------------------------------------------------------------------- 

