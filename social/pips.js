/** Rellena los puntos de progreso del carrusel según la posición de cada slide. */
(function () {
  var slides = document.querySelectorAll('.slide');
  slides.forEach(function (slide, i) {
    var pips = slide.querySelector('.pips');
    if (!pips) return;
    var html = '';
    for (var j = 0; j < slides.length; j++) html += '<i class="' + (j === i ? 'on' : '') + '"></i>';
    pips.innerHTML = html;
  });
})();
