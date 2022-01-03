/*
 | 0 1 2 |
 | 3 4 5 |
 | 6 7 8 |
 */
export class Matrix {
  constructor(elements) {
    this.elements = elements;
  }

  multiplyPosition(v) {
    return [
      this.elements[0] * v[0] + this.elements[1] * v[1] + this.elements[2],
      this.elements[3] * v[0] + this.elements[4] * v[1] + this.elements[5],
    ];
  }

  multiplyVector(v) {
    return [
      this.elements[0] * v[0] + this.elements[1] * v[1],
      this.elements[3] * v[0] + this.elements[4] * v[1],
    ];
  }

  get(r, c) {
    return this.elements[r * 3 + c];
  }

  set(r, c, value) {
    this.elements[r * 3 + c] = value;
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
  
  inverse() {
    const determinant =
      this.get(0, 0) * (this.get(1, 1) * this.get(2, 2) - this.get(2, 1) * this.get(1, 2)) -
      this.get(0, 1) * (this.get(1, 0) * this.get(2, 2) - this.get(1, 2) * this.get(2, 0)) -
      this.get(0, 2) * (this.get(1, 0) * this.get(2, 1) - this.get(1, 1) * this.get(2, 0));

    const inverseDeterminant = 1 / determinant;

    return new Matrix([
      (this.get(1, 1) * this.get(2, 2) - this.get(2, 1) * this.get(1, 2)) * inverseDeterminant,
      (this.get(0, 2) * this.get(2, 1) - this.get(0, 1) * this.get(2, 2)) * inverseDeterminant,
      (this.get(0, 1) * this.get(1, 2) - this.get(0, 2) * this.get(1, 1)) * inverseDeterminant,
      (this.get(1, 2) * this.get(2, 0) - this.get(1, 0) * this.get(2, 2)) * inverseDeterminant,
      (this.get(0, 0) * this.get(2, 2) - this.get(0, 2) * this.get(2, 0)) * inverseDeterminant,
      (this.get(1, 0) * this.get(0, 2) - this.get(0, 0) * this.get(1, 2)) * inverseDeterminant,
      (this.get(1, 0) * this.get(2, 1) - this.get(2, 0) * this.get(1, 1)) * inverseDeterminant,
      (this.get(2, 0) * this.get(0, 1) - this.get(0, 0) * this.get(2, 1)) * inverseDeterminant,
      (this.get(0, 0) * this.get(1, 1) - this.get(1, 0) * this.get(0, 1)) * inverseDeterminant,
    ]);
  }

  toString() {
    let s = '';
    for (let r = 0; r < 3; ++r) {
      for (let c = 0; c < 3; ++c) {
        let value = this.get(r, c).toFixed(3);
        s += value + ' ';
      }
      s += '\n';
    }
    return s;
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

  static unrotate(degrees) {
    return Matrix.rotate(-degrees);
  }

  static rotateAround(degrees, x, y) {
    const radians = degrees * Math.PI / 180;
    const c = Math.cos(radians);
    const s = Math.sin(radians);
    return new Matrix([
      c, -s, (1 - c) * x + s * y,
      s, c, -s * x + (1 - c) * y,
      0, 0, 1,
    ]);
  }

  static unrotateAround(degrees, x, y) {
    return Matrix.rotateAround(-degrees, x, y);
  }

  static scale(sx, sy) {
    return new Matrix([
      sx, 0, 0,
      0, sy, 0,
      0, 0, 1,
    ]);
  }

  static scaleAround(sx, sy, dx, dy) {
    return new Matrix([
      sx, 0, sx * -dx + dx,
      0, sy, sy * -dy + dy,
      0, 0, 1,
    ]);
  }

  static unscaleAround(sx, sy, dx, dy) {
    return Matrix.scaleAround(1 / sx, 1 / sy, dx, dy);
    // return new Matrix([
      // 1 / sx, 0, -dx / sx + dx,
      // 0, 1 / sy, -dy / sy + dy,
      // 0, 0, 1,
    // ]);
  }

  static translate(dx, dy) {
    return new Matrix([
      1, 0, dx,
      0, 1, dy,
      0, 0, 1,
    ]);
  }

  static untranslate(dx, dy) {
    return Matrix.translate(-dx, -dy);
  }

  static skew(sx, sy) {
    return null;
    // TODO
  }
}
