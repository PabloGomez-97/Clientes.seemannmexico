// src/components/Footer/PrivacyPolicy.tsx
import { Link } from "react-router-dom";
import { ArrowLeft, ShieldCheck } from "lucide-react";
import "./legal.css";

const LAST_UPDATED = "29 de abril de 2026";
const EFFECTIVE_DATE = "1 de enero de 2024";

const TOC_ITEMS = [
  { id: "s1", label: "1. Responsable del Tratamiento" },
  { id: "s2", label: "2. Datos que Recopilamos" },
  { id: "s3", label: "3. Base Legal del Tratamiento" },
  { id: "s4", label: "4. Cómo Usamos sus Datos" },
  { id: "s5", label: "5. Compartición de Datos" },
  { id: "s6", label: "6. Transferencias Internacionales" },
  { id: "s7", label: "7. Conservación de Datos" },
  { id: "s8", label: "8. Sus Derechos" },
  { id: "s9", label: "9. Seguridad de la Información" },
  { id: "s10", label: "10. Menores de Edad" },
  { id: "s11", label: "11. Cookies y Rastreo" },
  { id: "s12", label: "12. Cambios a esta Política" },
  { id: "s13", label: "13. Contacto" },
];

function PrivacyPolicy() {
  return (
    <div className="legal-page">
      {/* Header */}
      <header className="legal-header">
        <Link to="/" className="legal-header__brand">
          <img
            src="/logo.png"
            alt="Seemann Group"
            className="legal-header__logo"
            width={36}
            height={36}
          />
          <span className="legal-header__name">Seemann Group</span>
        </Link>
        <Link to="/" className="legal-header__back">
          <ArrowLeft size={14} />
          Volver al inicio
        </Link>
      </header>

      {/* Hero */}
      <section className="legal-hero">
        <span className="legal-hero__badge">
          <ShieldCheck
            size={12}
            style={{ display: "inline", marginRight: 4 }}
          />
          Documento Legal
        </span>
        <h1 className="legal-hero__title">Política de Privacidad</h1>
        <p className="legal-hero__meta">
          Última actualización: <strong>{LAST_UPDATED}</strong> · Vigente desde:{" "}
          <strong>{EFFECTIVE_DATE}</strong>
        </p>
      </section>

      {/* Body */}
      <main className="legal-body">
        {/* TOC */}
        <aside className="legal-toc" aria-label="Tabla de contenidos">
          <p className="legal-toc__title">Contenido</p>
          <ul className="legal-toc__list">
            {TOC_ITEMS.map((item) => (
              <li key={item.id} className="legal-toc__item">
                <a href={`#${item.id}`} className="legal-toc__link">
                  {item.label}
                </a>
              </li>
            ))}
          </ul>
        </aside>

        {/* Article */}
        <article className="legal-article">
          {/* Intro */}
          <div
            className="legal-infocard legal-infocard--blue"
            style={{ marginBottom: "2rem" }}
          >
            <span className="legal-infocard__heading">Resumen ejecutivo</span>
            En <strong>Seemann Group S.A.</strong> tratamos sus datos personales
            con la máxima responsabilidad. Esta Política explica qué datos
            recabamos, con qué finalidad, qué derechos le asisten y cómo puede
            ejercerlos. Le recomendamos leerla íntegramente antes de utilizar
            nuestros servicios.
          </div>

          {/* S1 */}
          <section className="legal-section" id="s1">
            <span className="legal-section__number">Artículo 01</span>
            <h2 className="legal-section__title">
              Responsable del Tratamiento de Datos
            </h2>
            <div className="legal-section__body">
              <p>El responsable del tratamiento de sus datos personales es:</p>
              <div className="legal-contact-card">
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Razón Social
                  </span>
                  <span className="legal-contact-item__value">
                    Seemann Group S.A.
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Domicilio Social
                  </span>
                  <span className="legal-contact-item__value">
                    Av. Libertad #1405, of. 1203
                    <br />
                    Viña del Mar, Chile 2520000
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">RUT</span>
                  <span className="legal-contact-item__value">-</span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Correo de Privacidad
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:privacidad@seemanngroup.com">
                      contacto@seemanngroup.com
                    </a>
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">Teléfono</span>
                  <span className="legal-contact-item__value">
                    +56 2 2604 8386
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Delegado de Protección (DPO)
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:dpo@seemanngroup.com">
                      pablo@sphereglobal.io
                    </a>
                  </span>
                </div>
              </div>
            </div>
          </section>

          {/* S2 */}
          <section className="legal-section" id="s2">
            <span className="legal-section__number">Artículo 02</span>
            <h2 className="legal-section__title">
              Datos Personales que Recopilamos
            </h2>
            <div className="legal-section__body">
              <p>
                Recopilamos distintas categorías de datos personales según el
                tipo de interacción que usted mantiene con nosotros:
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Categoría</th>
                      <th>Datos específicos</th>
                      <th>Fuente</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Datos de Identificación</strong>
                      </td>
                      <td>
                        Nombre completo, número de identificación, pasaporte,
                        RUC/NIT, número de empresa
                      </td>
                      <td>Proporcionados por el usuario</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos de Contacto</strong>
                      </td>
                      <td>
                        Correo electrónico, número de teléfono, dirección
                        postal, dirección fiscal
                      </td>
                      <td>Proporcionados por el usuario</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos de Envío</strong>
                      </td>
                      <td>
                        Origen, destino, tipo de mercancía, peso/volumen,
                        documentos aduaneros (BL, AWB, DIM), número de
                        contenedor
                      </td>
                      <td>Proporcionados y generados en el sistema</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos de Cuenta</strong>
                      </td>
                      <td>
                        Nombre de usuario, contraseña cifrada, rol, historial de
                        accesos, preferencias
                      </td>
                      <td>Creados por el usuario y el sistema</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos de Navegación</strong>
                      </td>
                      <td>
                        Dirección IP, tipo de navegador, sistema operativo,
                        páginas visitadas, duración de sesión, cookies
                      </td>
                      <td>Recabados automáticamente</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos Financieros</strong>
                      </td>
                      <td>
                        Información de facturación, referencias de pago,
                        historial de transacciones (no se almacenan datos
                        completos de tarjeta)
                      </td>
                      <td>Proporcionados por el usuario / pasarela de pago</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Datos de Comunicaciones</strong>
                      </td>
                      <td>
                        Contenido de mensajes enviados a través de nuestro
                        formularios de contacto y correo electrónico
                      </td>
                      <td>Generados por el usuario</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div className="legal-infocard">
                <span className="legal-infocard__heading">Datos sensibles</span>
                Seemann Group no recaba intencionalmente datos sensibles (origen
                étnico, salud, religión, orientación sexual, datos biométricos).
                Si en alguna comunicación usted los proporciona voluntariamente,
                los trataremos con las garantías reforzadas previstas en la Ley
                81 de 2019 de la República de Panamá y el RGPD.
              </div>
            </div>
          </section>

          {/* S3 */}
          <section className="legal-section" id="s3">
            <span className="legal-section__number">Artículo 03</span>
            <h2 className="legal-section__title">Base Legal del Tratamiento</h2>
            <div className="legal-section__body">
              <p>
                El tratamiento de sus datos personales se sustenta en las
                siguientes bases legales, de conformidad con el Reglamento
                General de Protección de Datos (RGPD - UE 2016/679), la Ley 81
                de 2019 de Panamá y la California Consumer Privacy Act (CCPA):
              </p>
              <ul>
                <li>
                  <strong>Ejecución de contrato (Art. 6.1.b RGPD):</strong>{" "}
                  Cuando el tratamiento es necesario para la prestación de los
                  servicios logísticos contratados, incluyendo la emisión de
                  documentos, gestión de embarques, facturación y tracking.
                </li>
                <li>
                  <strong>Consentimiento (Art. 6.1.a RGPD):</strong> Para el
                  envío de comunicaciones comerciales, boletines informativos,
                  notificaciones de tarifas y uso de cookies no esenciales.
                  Puede retirar su consentimiento en cualquier momento.
                </li>
                <li>
                  <strong>Obligación legal (Art. 6.1.c RGPD):</strong> Para
                  cumplir con obligaciones aduaneras, tributarias, de lavado de
                  activos (AML), FATF y regulaciones portuarias internacionales.
                </li>
                <li>
                  <strong>Interés legítimo (Art. 6.1.f RGPD):</strong> Para
                  mejorar nuestros servicios, prevenir fraudes, garantizar la
                  seguridad de la plataforma y realizar análisis estadísticos
                  agregados del negocio.
                </li>
                <li>
                  <strong>Interés vital (Art. 6.1.d RGPD):</strong> En
                  situaciones excepcionales donde sea necesario proteger la
                  integridad física de personas involucradas en los envíos.
                </li>
              </ul>
            </div>
          </section>

          {/* S4 */}
          <section className="legal-section" id="s4">
            <span className="legal-section__number">Artículo 04</span>
            <h2 className="legal-section__title">
              Cómo Utilizamos sus Datos Personales
            </h2>
            <div className="legal-section__body">
              <p>
                Los datos personales recopilados son utilizados para las
                siguientes finalidades:
              </p>
              <ul>
                <li>
                  <strong>
                    Gestión de embarques y operaciones logísticas:
                  </strong>{" "}
                  Coordinación de envíos aéreos, marítimos (FCL/LCL) y
                  terrestres; preparación de documentos de transporte (Bill of
                  Lading, AWB, Packing List, Certificados de Origen); gestión
                  aduanera y coordinación con agencias de aduana.
                </li>
                <li>
                  <strong>Prestación de la plataforma digital:</strong>{" "}
                  Autenticación de usuarios, generación y visualización de
                  cotizaciones, tracking en tiempo real de envíos, acceso a
                  documentación y reportes.
                </li>
                <li>
                  <strong>Comunicaciones operativas:</strong> Notificaciones
                  sobre el estado de embarques, alertas de tarifas, vencimiento
                  de documentos, confirmaciones de cotizaciones y facturas.
                </li>
                <li>
                  <strong>Facturación y pagos:</strong> Emisión de facturas,
                  seguimiento de cuentas por cobrar, gestión de crédito
                  comercial y conciliación de pagos.
                </li>
                <li>
                  <strong>Mejora del servicio y análisis:</strong> Análisis de
                  comportamiento dentro de la plataforma (con datos anonimizados
                  o seudonimizados), métricas de rendimiento del servicio y
                  detección de anomalías.
                </li>
                <li>
                  <strong>Cumplimiento legal y regulatorio:</strong> Reporte a
                  autoridades aduaneras (ANA Panamá, CBP EE.UU., AEAT España,
                  etc.), cumplimiento de sanciones internacionales (OFAC, EU
                  Sanctions) y normativa IATA.
                </li>
                <li>
                  <strong>
                    Marketing y comunicaciones comerciales (solo con
                    consentimiento):
                  </strong>
                  Envío de newsletter, información sobre nuevas rutas, tarifas
                  promocionales y actualizaciones del sector logístico.
                </li>
                <li>
                  <strong>Atención al cliente:</strong> Gestión de solicitudes,
                  reclamos, consultas y soporte técnico a través de
                  canales convencionales.
                </li>
              </ul>
            </div>
          </section>

          {/* S5 */}
          <section className="legal-section" id="s5">
            <span className="legal-section__number">Artículo 05</span>
            <h2 className="legal-section__title">
              Compartición y Divulgación de Datos
            </h2>
            <div className="legal-section__body">
              <p>
                Seemann Group no vende ni alquila sus datos personales a
                terceros. Solo compartimos sus datos en las circunstancias
                descritas a continuación, aplicando en todo caso los mecanismos
                contractuales y técnicos apropiados:
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Destinatario</th>
                      <th>Finalidad</th>
                      <th>Base legal</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>
                        <strong>Navieras y aerolíneas</strong>
                        <br />
                        (MSC, Hapag-Lloyd, Maersk, Lufthansa Cargo, etc.)
                      </td>
                      <td>
                        Reserva de espacio, emisión de B/L y AWB, coordinación
                        de rutas
                      </td>
                      <td>Ejecución de contrato</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Agentes de aduana</strong>
                      </td>
                      <td>
                        Despacho aduanero, presentación de declaraciones y
                        manifiestos
                      </td>
                      <td>Ejecución de contrato / Obligación legal</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Autoridades gubernamentales</strong>
                        <br />
                        (ANA, ANAN, OFAC, CBP, etc.)
                      </td>
                      <td>
                        Cumplimiento de obligaciones legales, aduaneras y de
                        seguridad
                      </td>
                      <td>Obligación legal</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Proveedores tecnológicos</strong>
                        <br />
                        (Vercel, Cloudflare R2, Supabase/PostgreSQL, OpenAI)
                      </td>
                      <td>
                        Infraestructura de la plataforma, almacenamiento seguro,
                        IA asistida
                      </td>
                      <td>Interés legítimo / Contrato de encargo</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Proveedores de transporte last-mile</strong>
                      </td>
                      <td>Entrega de mercancía en destino final</td>
                      <td>Ejecución de contrato</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Servicios de correo electrónico</strong>
                        <br />
                        (Resend)
                      </td>
                      <td>
                        Envío de notificaciones operativas, cotizaciones y
                        alertas
                      </td>
                      <td>Ejecución de contrato / Consentimiento</td>
                    </tr>
                    <tr>
                      <td>
                        <strong>Plataformas de análisis</strong>
                        <br />
                        (Vercel Analytics/Speed Insights)
                      </td>
                      <td>Monitoreo de rendimiento (datos anonimizados)</td>
                      <td>Interés legítimo</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                Todos los terceros que actúan como encargados del tratamiento
                están sujetos a Acuerdos de Tratamiento de Datos (ATD/DPA) que
                los obligan a implementar medidas de seguridad adecuadas y a no
                tratar los datos para finalidades propias.
              </p>
            </div>
          </section>

          {/* S6 */}
          <section className="legal-section" id="s6">
            <span className="legal-section__number">Artículo 06</span>
            <h2 className="legal-section__title">
              Transferencias Internacionales de Datos
            </h2>
            <div className="legal-section__body">
              <p>
                Dado el carácter global de los servicios de transporte
                internacional que ofrecemos, sus datos pueden ser transferidos y
                procesados en países distintos al de su residencia. Seemann
                Group aplica los siguientes mecanismos de garantía para dichas
                transferencias:
              </p>
              <ul>
                <li>
                  <strong>
                    Cláusulas Contractuales Tipo (CCT/SCC) de la Comisión
                    Europea:
                  </strong>
                  Para transferencias hacia países sin decisión de adecuación
                  reconocida por la UE.
                </li>
                <li>
                  <strong>Decisiones de adecuación:</strong> Cuando los datos
                  son transferidos a países que gozan de un nivel de protección
                  reconocido como adecuado por la Comisión Europea (p. ej.,
                  Reino Unido, Canadá, Japón, Suiza).
                </li>
                <li>
                  <strong>
                    Obligaciones contractuales con transportistas:
                  </strong>{" "}
                  Los convenios internacionales de transporte (Convenio de
                  Montreal, Reglas de la Haya-Visby, Incoterms ICC) establecen
                  obligaciones de confidencialidad sobre la información de
                  carga.
                </li>
                <li>
                  <strong>Cumplimiento de Ley 81 de Panamá:</strong> Toda
                  transferencia internacional cumple con los requisitos
                  establecidos en el Capítulo V de la Ley 81 de 2019.
                </li>
              </ul>
              <div className="legal-infocard legal-infocard--blue">
                <span className="legal-infocard__heading">
                  Países destinatarios principales
                </span>
                Estados Unidos, Unión Europea, China, Japón, Corea del Sur,
                Emiratos Árabes Unidos, México, Colombia, Chile, Brasil y demás
                destinos de nuestras rutas logísticas activas. Para cada uno
                aplicamos el mecanismo de garantía apropiado conforme a la
                normativa vigente.
              </div>
            </div>
          </section>

          {/* S7 */}
          <section className="legal-section" id="s7">
            <span className="legal-section__number">Artículo 07</span>
            <h2 className="legal-section__title">Conservación de Datos</h2>
            <div className="legal-section__body">
              <p>
                Conservamos sus datos personales únicamente durante el tiempo
                necesario para cumplir con las finalidades para las que fueron
                recabados, o mientras existan obligaciones legales que lo
                exijan:
              </p>

              <div className="legal-table-wrapper">
                <table className="legal-table">
                  <thead>
                    <tr>
                      <th>Tipo de dato</th>
                      <th>Período de conservación</th>
                      <th>Fundamento</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr>
                      <td>Datos de cuenta de usuario activa</td>
                      <td>
                        Mientras la cuenta esté activa + 6 meses tras el cierre
                      </td>
                      <td>Ejecución de contrato</td>
                    </tr>
                    <tr>
                      <td>
                        Documentos de envío y aduaneros (BL, AWB, Packing List,
                        CI)
                      </td>
                      <td>10 años</td>
                      <td>
                        Obligación fiscal y aduanera (Código Fiscal de Panamá)
                      </td>
                    </tr>
                    <tr>
                      <td>Registros de facturación y contables</td>
                      <td>10 años</td>
                      <td>Ley 57 de 2008, Código Fiscal de Panamá</td>
                    </tr>
                    <tr>
                      <td>Cotizaciones y comunicaciones comerciales</td>
                      <td>5 años</td>
                      <td>
                        Posibles reclamaciones contractuales (Código de
                        Comercio)
                      </td>
                    </tr>
                    <tr>
                      <td>Logs de acceso y seguridad</td>
                      <td>12 meses</td>
                      <td>
                        Seguridad de sistemas e investigación de incidentes
                      </td>
                    </tr>
                    <tr>
                      <td>Datos de cookies y análisis web</td>
                      <td>13 meses máximo</td>
                      <td>Consentimiento / Interés legítimo</td>
                    </tr>
                    <tr>
                      <td>
                        Comunicaciones de marketing (si dio consentimiento)
                      </td>
                      <td>Hasta retirada del consentimiento</td>
                      <td>Consentimiento</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <p>
                Transcurridos los períodos indicados, sus datos serán eliminados
                de forma segura o anonimizados de manera irreversible para su
                uso estadístico.
              </p>
            </div>
          </section>

          {/* S8 */}
          <section className="legal-section" id="s8">
            <span className="legal-section__number">Artículo 08</span>
            <h2 className="legal-section__title">
              Sus Derechos como Titular de los Datos
            </h2>
            <div className="legal-section__body">
              <p>
                De conformidad con la Ley 81 de 2019 de la República de Panamá,
                el RGPD europeo (cuando resulte aplicable) y la CCPA
                californiana, usted dispone de los siguientes derechos:
              </p>
              <ul>
                <li>
                  <strong>Derecho de acceso:</strong> Conocer qué datos
                  personales suyos tratamos, con qué finalidad, su origen y
                  destinatarios.
                </li>
                <li>
                  <strong>Derecho de rectificación:</strong> Solicitar la
                  corrección de datos inexactos o incompletos.
                </li>
                <li>
                  <strong>Derecho de supresión ("derecho al olvido"):</strong>{" "}
                  Solicitar la eliminación de sus datos cuando ya no sean
                  necesarios, cuando retire el consentimiento o cuando se hayan
                  tratado ilícitamente. Este derecho puede estar limitado por
                  obligaciones legales de conservación.
                </li>
                <li>
                  <strong>Derecho de oposición:</strong> Oponerse al tratamiento
                  de sus datos para finalidades de marketing directo o cuando se
                  base en el interés legítimo.
                </li>
                <li>
                  <strong>Derecho a la limitación del tratamiento:</strong>{" "}
                  Solicitar la suspensión temporal del tratamiento mientras se
                  resuelve una impugnación o reclamación.
                </li>
                <li>
                  <strong>Derecho a la portabilidad:</strong> Recibir sus datos
                  en un formato estructurado, de uso común y legible por
                  máquina, y transferirlos a otro responsable del tratamiento.
                </li>
                <li>
                  <strong>
                    Derecho a no ser objeto de decisiones automatizadas:
                  </strong>{" "}
                  No ser sujeto de decisiones basadas exclusivamente en el
                  tratamiento automatizado de datos que le produzcan efectos
                  jurídicos o le afecten de modo significativo.
                </li>
                <li>
                  <strong>Derecho a retirar el consentimiento:</strong> En
                  cualquier momento, sin que ello afecte a la licitud del
                  tratamiento previo.
                </li>
              </ul>

              <div className="legal-infocard legal-infocard--green">
                <span className="legal-infocard__heading">
                  ¿Cómo ejercer sus derechos?
                </span>
                Envíe su solicitud por escrito a{" "}
                <a href="mailto:privacidad@seemanngroup.com">
                  privacidad@seemanngroup.com
                </a>{" "}
                indicando: su nombre completo, documento de identidad, derecho
                que desea ejercer y, si aplica, dirección de respuesta.
                Responderemos en un plazo máximo de{" "}
                <strong>30 días hábiles</strong>. Si considera que su solicitud
                no ha sido atendida adecuadamente, puede presentar una
                reclamación ante la Autoridad Nacional para la Transparencia y
                Acceso a la Información (ANTAI) de Panamá, o ante la autoridad
                de protección de datos competente de su país.
              </div>
            </div>
          </section>

          {/* S9 */}
          <section className="legal-section" id="s9">
            <span className="legal-section__number">Artículo 09</span>
            <h2 className="legal-section__title">
              Seguridad de la Información
            </h2>
            <div className="legal-section__body">
              <p>
                Seemann Group implementa medidas técnicas y organizativas
                adecuadas para proteger sus datos personales contra el acceso no
                autorizado, la pérdida accidental, la alteración o la
                divulgación indebida. Estas medidas incluyen:
              </p>
              <ul>
                <li>
                  <strong>Cifrado en tránsito:</strong> Todas las comunicaciones
                  entre su navegador y nuestra plataforma utilizan protocolos
                  TLS 1.2 / TLS 1.3 (HTTPS).
                </li>
                <li>
                  <strong>Cifrado en reposo:</strong> Los datos almacenados en
                  bases de datos y sistemas de archivos están cifrados con
                  AES-256 o equivalente.
                </li>
                <li>
                  <strong>Contraseñas:</strong> Las contraseñas de usuarios se
                  almacenan exclusivamente como hashes criptográficos (bcrypt
                  con salt), nunca en texto plano.
                </li>
                <li>
                  <strong>Control de acceso:</strong> Acceso basado en roles
                  (RBAC) con principio de mínimo privilegio. Autenticación de
                  dos factores disponible para cuentas administrativas.
                </li>
                <li>
                  <strong>Auditoría y monitoreo:</strong> Registros de acceso y
                  actividad, monitoreo de anomalías, alertas automáticas ante
                  intentos de acceso sospechoso.
                </li>
                <li>
                  <strong>Infraestructura:</strong> Alojada en proveedores cloud
                  de nivel enterprise (Vercel/Cloudflare) con certificaciones
                  SOC 2 Type II e ISO 27001.
                </li>
                <li>
                  <strong>Gestión de incidentes:</strong> Procedimiento
                  documentado de respuesta ante brechas de seguridad. En caso de
                  brecha que afecte sus derechos y libertades, le notificaremos
                  en un plazo máximo de 72 horas.
                </li>
                <li>
                  <strong>Evaluaciones periódicas:</strong> Realizamos
                  revisiones de seguridad, pruebas de penetración y análisis de
                  vulnerabilidades de forma regular.
                </li>
              </ul>
              <p>
                Ningún sistema de transmisión de datos por Internet puede
                garantizar una seguridad absoluta. Si sospecha que su cuenta ha
                sido comprometida, contáctenos de inmediato en{" "}
                <a href="mailto:seguridad@seemanngroup.com">
                  seguridad@seemanngroup.com
                </a>
                .
              </p>
            </div>
          </section>

          {/* S10 */}
          <section className="legal-section" id="s10">
            <span className="legal-section__number">Artículo 10</span>
            <h2 className="legal-section__title">Menores de Edad</h2>
            <div className="legal-section__body">
              <p>
                Los servicios de Seemann Group están dirigidos exclusivamente a
                personas mayores de 18 años que actúen en calidad de empresas,
                importadores, exportadores o profesionales del comercio
                internacional. No recabamos ni tratamos intencionalmente datos
                personales de menores de 18 años.
              </p>
              <p>
                Si tenemos conocimiento de haber recabado datos de un menor sin
                el consentimiento parental verificable requerido, procederemos a
                eliminar dicha información de forma inmediata. Si usted es
                padre, madre o tutor legal y cree que un menor a su cargo nos ha
                proporcionado datos personales, contáctenos en{" "}
                <a href="mailto:privacidad@seemanngroup.com">
                  privacidad@seemanngroup.com
                </a>
                .
              </p>
            </div>
          </section>

          {/* S11 */}
          <section className="legal-section" id="s11">
            <span className="legal-section__number">Artículo 11</span>
            <h2 className="legal-section__title">
              Cookies y Tecnologías de Rastreo
            </h2>
            <div className="legal-section__body">
              <p>
                Nuestra plataforma utiliza cookies y tecnologías similares para
                garantizar el funcionamiento correcto del sitio, analizar el uso
                de la plataforma y, con su consentimiento, ofrecer contenido
                personalizado. Para información detallada sobre los tipos de
                cookies que utilizamos, su duración, proveedores y cómo
                gestionar sus preferencias, consulte nuestra{" "}
                <Link to="/cookie-settings">Política de Cookies</Link>.
              </p>
              <p>
                Puede modificar sus preferencias de cookies en cualquier momento
                accediendo a la Configuración de Cookies disponible en el pie de
                página de nuestra plataforma.
              </p>
            </div>
          </section>

          {/* S12 */}
          <section className="legal-section" id="s12">
            <span className="legal-section__number">Artículo 12</span>
            <h2 className="legal-section__title">
              Cambios a esta Política de Privacidad
            </h2>
            <div className="legal-section__body">
              <p>
                Seemann Group se reserva el derecho de modificar esta Política
                de Privacidad en cualquier momento para reflejar cambios en
                nuestras prácticas, servicios, normativa aplicable o
                requerimientos regulatorios.
              </p>
              <p>
                Cuando realicemos cambios materiales, le notificaremos con al
                menos <strong>15 días de antelación</strong> mediante uno o
                varios de los siguientes mecanismos: aviso prominente en la
                plataforma, notificación por correo electrónico a la dirección
                registrada en su cuenta, o banner informativo en el acceso a la
                plataforma.
              </p>
              <p>
                La fecha de la "Última actualización" al inicio de este
                documento refleja cuándo se realizó la revisión más reciente. El
                uso continuado de la plataforma tras la entrada en vigor de los
                cambios constituirá su aceptación de la nueva versión. Si no
                está de acuerdo con los cambios, deberá cesar el uso de la
                plataforma y puede solicitar la eliminación de su cuenta.
              </p>
              <p>
                Conservamos las versiones anteriores de esta Política accesibles
                bajo solicitud.
              </p>
            </div>
          </section>

          {/* S13 */}
          <section className="legal-section" id="s13">
            <span className="legal-section__number">Artículo 13</span>
            <h2 className="legal-section__title">Contacto y Reclamaciones</h2>
            <div className="legal-section__body">
              <p>
                Para cualquier consulta, solicitud de ejercicio de derechos o
                reclamación relacionada con el tratamiento de sus datos
                personales, puede contactarnos a través de los siguientes
                canales:
              </p>
              <div className="legal-contact-card">
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Email de Privacidad
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:privacidad@seemanngroup.com">
                      privacidad@seemanngroup.com
                    </a>
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Delegado de Protección (DPO)
                  </span>
                  <span className="legal-contact-item__value">
                    <a href="mailto:dpo@seemanngroup.com">
                      dpo@seemanngroup.com
                    </a>
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">Teléfono</span>
                  <span className="legal-contact-item__value">
                    +507 300-0000
                  </span>
                </div>
                <div className="legal-contact-item">
                  <span className="legal-contact-item__label">
                    Dirección Postal
                  </span>
                  <span className="legal-contact-item__value">
                    Av. Libertad #1405, of. 1203
                    <br />
                    Viña del Mar, Chile 2520000
                    <br />
                    Chile
                  </span>
                </div>
              </div>
              <div className="legal-infocard" style={{ marginTop: "1.5rem" }}>
                <span className="legal-infocard__heading">
                  Autoridad supervisora
                </span>
                Si reside en la Unión Europea y considera que el tratamiento de
                sus datos infringe el RGPD, tiene derecho a presentar una
                reclamación ante la autoridad de control de su Estado miembro.
                En Panamá, la autoridad competente es la Autoridad Nacional para
                la Transparencia y Acceso a la Información (ANTAI).
              </div>
            </div>
          </section>
        </article>
      </main>

      {/* Footer */}
      <footer className="legal-footer">
        <p>
          © {new Date().getFullYear()} Seemann Group S.A. · Todos los derechos
          reservados · <Link to="/terms-of-service">Términos de Servicio</Link>{" "}
          · <Link to="/cookie-settings">Configuración de Cookies</Link>
        </p>
      </footer>
    </div>
  );
}

export default PrivacyPolicy;
