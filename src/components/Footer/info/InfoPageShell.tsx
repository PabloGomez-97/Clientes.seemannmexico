import React from "react";
import "./info-pages.css";
import "./info-pages.css";

type Props = {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
};

const InfoPageShell: React.FC<Props> = ({ title, subtitle, children }) => (
  <div className="info-page">
    <header className="info-page__header">
      <h1 className="info-page__title">{title}</h1>
      {subtitle && <p className="info-page__subtitle">{subtitle}</p>}
    </header>
    {children}
  </div>
);

export default InfoPageShell;
