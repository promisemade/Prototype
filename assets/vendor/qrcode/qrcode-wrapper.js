/* Wrapper pour compatibilité avec le prototype : expose window.QRCode(url) */
/* global qrcode */
(function(){
  if(typeof window === 'undefined') return;
  if(window.QRCode) return;

  // qrcode-generator expose une fonction globale "qrcode" (via qrcode.js)
  if(typeof window.qrcode !== 'function') return;

  window.QRCode = function(text){
    const qr = window.qrcode(0, 'L');
    qr.addData(String(text));
    qr.make();
    return qr;
  };
})();
