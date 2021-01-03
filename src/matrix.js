export class Matrix {
  constructor(elements) {
    this.elements = elements;
  }

  multiplyVector(v) {
    return [
      this.elements[0] * v[0] + this.elements[1] * v[1] + this.elements[2],
      this.elements[3] * v[0] + this.elements[4] * v[1] + this.elements[5],
    ];
  }

  multiplyMatrix(m) {
    return new Matrix([
      this.elements[0] * m.elements[0] + this.elements[1] * m.elements[3] + this.elements[2] * m.elements[6], // row 0, column 0
      this.elements[0] * m.elements[1] + this.elements[1] * m.elements[4] + this.elements[2] * m.elements[7], // row 0, column 1
      this.elements[0] * m.elements[2] + this.elements[1] * m.elements[5] + this.elements[2] * m.elements[8], // row 0, column 1

      this.elements[3] * m.elements[0] + this.elements[4] * m.elements[3] + this.elements[5] * m.elements[6], // row 1, column 0
      this.elements[3] * m.elements[1] + this.elements[4] * m.elements[4] + this.elements[5] * m.elements[7], // row 1, column 1
      this.elements[3] * m.elements[2] + this.elements[4] * m.elements[5] + this.elements[5] * m.elements[8], // row 1, column 1

      this.elements[6] * m.elements[0] + this.elements[7] * m.elements[3] + this.elements[8] * m.elements[6], // row 2, column 0
      this.elements[6] * m.elements[1] + this.elements[7] * m.elements[4] + this.elements[8] * m.elements[7], // row 2, column 1
      this.elements[6] * m.elements[2] + this.elements[7] * m.elements[5] + this.elements[8] * m.elements[8], // row 2, column 1
    ]);
  }

  static identity() {
    return new Matrix([
      1, 0, 0,
      0, 1, 0,
      0, 0, 1,
    ]);
  }

  static rotate(degrees) {
    const radians = degrees * Math.PI / 180;
    return new Matrix([
      Math.cos(radians), -Math.sin(radians), 0,
      Math.sin(radians), Math.cos(radians), 0,
      0, 0, 1,
    ]);
  }

  static scale(sx, sy) {
    return new Matrix([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ]);
  }

  static translate(dx, dy) {
    return new Matrix([
      1, 0, dx,
      0, 1, dy,
      0, 0, 1,
    ]);
  }

  static skew(sx, sy) {
    return null;
    // TODO
  }
}
