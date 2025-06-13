
// _app.js
import React, { useEffect, useState, } from "react";
import { BrowserRouter as Router, Routes, Route } from "react-router-dom";
import { PrimeReactProvider } from 'primereact/api';
import SplitterWidget from './components/Layout';

// import 'primereact/resources/themes/lara-light-cyan/theme.css';
// import 'primereact/resources/themes/lara-dark-blue/theme.css';
import 'primeflex/primeflex.css';

const App: React.FC = () => {
    const theme = localStorage.getItem('theme');
    if (theme === 'dark') {
        const themeLink = document.getElementById('theme-link') as HTMLLinkElement;
        themeLink.href = '/themes/lara-dark-blue/theme.css';
    }

    return (
        <Router>
            <Routes>
                <Route path="/" element={<SplitterWidget />} />
            </Routes>
        </Router>
    );
}

export default App;
