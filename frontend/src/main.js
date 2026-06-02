import { initRouter } from './router.js';
import './styles/base.css';
import './styles/layout.css';
import './styles/components.css';
import './styles/mikrodash-theme.css';
import './vendor/tabler.min.css';

// Apply saved theme from localStorage
const savedTheme = localStorage.getItem('mikrodash_theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

initRouter();
