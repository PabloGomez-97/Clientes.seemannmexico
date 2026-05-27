import { useState } from "react";
import { Tab, Tabs } from "react-bootstrap";
import TarifarioAereo from "../Proveedores/TarifarioAereo";
import TarifarioFCL from "../Proveedores/TarifarioFCL";
import TarifarioLCL from "../Proveedores/TarifarioLCL";
import "../administrador/PricingTabs.css";
import { imgUrl } from "../../config/images";

function TarifarioCompleto() {
  const [activeKey, setActiveKey] = useState<string>("air");

  return (
    <div className="pricing-tabs-container">
      {/* Header */}
      <div className="pricing-header">
        <div className="header-content">
          <div className="header-left">
            <img
              src={imgUrl("/logocompleto.png")}
              alt="Seemann Group Logo"
              className="header-logo"
            />
            <div className="header-text">
              <h1 className="header-title">Tarifario Completo</h1>
              <p className="header-subtitle">
                Visualización de todas las tarifas de todos los proveedores en
                un solo lugar
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-wrapper">
        <Tabs
          id="tarifario-completo-tabs"
          activeKey={activeKey}
          onSelect={(k) => setActiveKey(k as string)}
          className="custom-tabs"
        >
          <Tab
            eventKey="air"
            title={
              <div className="tab-title">
                <i className="bi bi-airplane-fill tab-icon"></i>
                <span>Aéreo</span>
              </div>
            }
            tabClassName={activeKey === "air" ? "tab-active" : "tab-inactive"}
          >
            <div className="tab-content-panel">
              <TarifarioAereo showAddForm={false} />
            </div>
          </Tab>

          <Tab
            eventKey="fcl"
            title={
              <div className="tab-title">
                <i className="bi bi-box-seam-fill tab-icon"></i>
                <span>FCL</span>
              </div>
            }
            tabClassName={activeKey === "fcl" ? "tab-active" : "tab-inactive"}
          >
            <div className="tab-content-panel">
              <TarifarioFCL showAddForm={false} />
            </div>
          </Tab>

          <Tab
            eventKey="lcl"
            title={
              <div className="tab-title">
                <i className="bi bi-box2-fill tab-icon"></i>
                <span>LCL</span>
              </div>
            }
            tabClassName={activeKey === "lcl" ? "tab-active" : "tab-inactive"}
          >
            <div className="tab-content-panel">
              <TarifarioLCL showAddForm={false} />
            </div>
          </Tab>
        </Tabs>
      </div>
    </div>
  );
}

export default TarifarioCompleto;
