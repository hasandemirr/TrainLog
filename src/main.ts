import { h, render } from 'preact';
import { App } from './ui/App';
import './ui/styles.css';

const root = document.getElementById('app');
if (root) {
  // Temiz başlangıç URL'si (D40: üst görünüm hash'i)
  if (!location.hash) history.replaceState(null, '', '#/workout');
  render(h(App, {}), root);
}
