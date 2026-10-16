import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Link, Route, Routes } from 'react-router';
import { ClassroomListPage } from './pages/ClassroomListPage.tsx';
import { TeachPage } from './pages/TeachPage.tsx';
import { WatchPage } from './pages/WatchPage.tsx';
import './styles.css';

function App() {
  return (
    <>
      <header className="topbar">
        <Link to="/" className="brand">
          온라인 강의실
        </Link>
      </header>
      <main className="container">
        <Routes>
          <Route path="/" element={<ClassroomListPage />} />
          <Route path="/classrooms/:id/teach" element={<TeachPage />} />
          <Route path="/classrooms/:id/watch" element={<WatchPage />} />
          <Route path="*" element={<p>페이지를 찾을 수 없습니다.</p>} />
        </Routes>
      </main>
    </>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
);
