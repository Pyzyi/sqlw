// Setzt das gespeicherte Farbschema vor dem ersten Rendern (verhindert Aufblitzen).
try {
  var t = JSON.parse(localStorage.getItem('sqlwork.state.v1') || '{}').theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
} catch (e) { /* ignore */ }
