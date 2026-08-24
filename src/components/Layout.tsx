import React, { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../lib/AuthContext";
import { MENU } from "../lib/menu";

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, has, logout } = useAuth();
  const location = useLocation();

  const visibleGroups = useMemo(() => MENU.filter((g) => has(...g.perfis)), [has]);
  const activeGroupLabel = useMemo(
    () => visibleGroups.find((g) => g.items.some((i) => location.pathname.startsWith(i.path)))?.label,
    [visibleGroups, location.pathname]
  );
  const [openGroup, setOpenGroup] = useState<string | undefined>(activeGroupLabel);

  // Mantém o grupo do menu sincronizado com a rota atual (ex: navegação por
  // um link direto, não só clicando na barra lateral).
  useEffect(() => {
    if (activeGroupLabel) setOpenGroup(activeGroupLabel);
  }, [activeGroupLabel]);

  const effectiveOpen = openGroup ?? activeGroupLabel;

  const initials = user ? `${user.nome[0] || ""}${user.sobrenome[0] || ""}`.toUpperCase() : "";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-header">
          <img src="/logo-carcara.jpg" alt="Carcará" style={{ width: 34, borderRadius: 6 }} />
          <div>
            <div className="title">CARCARÁ</div>
            <div className="subtitle">SISTEMA DE MISSÕES</div>
          </div>
        </div>
        <nav className="nav">
          {visibleGroups.map((group) => {
            const isOpen = effectiveOpen === group.label;
            return (
              <div className={`nav-group${isOpen ? " open" : ""}`} key={group.label}>
                <div
                  className="nav-group-label"
                  onClick={() => setOpenGroup(isOpen ? undefined : group.label)}
                >
                  <span>{group.label}</span>
                  <span>{isOpen ? "−" : "+"}</span>
                </div>
                {isOpen && (
                  <div className="nav-sub">
                    {group.items.map((item) => (
                      <NavLink
                        key={item.path}
                        to={item.path}
                        className={({ isActive }) => (isActive ? "active" : "")}
                      >
                        {item.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
        <div className="sidebar-footer">
          <div className="avatar">{initials}</div>
          <div className="user-meta">
            <div className="name">
              {user?.nome} {user?.sobrenome}
            </div>
            <div className="perfis">{user?.perfis.join(", ")}</div>
          </div>
          <button className="logout-btn" onClick={() => logout()}>
            Sair
          </button>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}

export function PageHeader({ crumbs, title }: { crumbs: string; title: string }) {
  return (
    <div className="page-header">
      <div className="crumbs">{crumbs}</div>
      <h1>{title}</h1>
    </div>
  );
}
