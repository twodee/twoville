function ExpressionRectangle() {
  this.evaluate = function(env) {
    var valueLeft = env['left'].real();
    var valueBottom = env['bottom'].real();
    var valueWidth = env['width'].real();
    var valueHeight = env['height'].real();

    var rectangle = document.createElementNS(namespace, 'rect');
    rectangle.setAttributeNS(null, 'x', valueLeft);
    rectangle.setAttributeNS(null, 'y', valueBottom);
    rectangle.setAttributeNS(null, 'width', valueWidth);
    rectangle.setAttributeNS(null, 'height', valueHeight);
    rectangle.setAttributeNS(null, 'fill', '#FF00FF');
    env.svg.appendChild(rectangle);
  };
}
