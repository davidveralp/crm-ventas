# Patio · Gestión de automotora

App web de un solo archivo (`index.html`) para automotoras de compraventa y consignación. Vertical de VPAI.

## Módulos
- **Inventario**: ficha por vehículo y flujo de estados (evaluación → disponible → reservado → vendido → entregado). La verificación legal obligatoria bloquea la publicación.
- **Consignación**: contrato con precio mínimo, comisión fija o %, plazo y liquidación automática al vender.
- **Leads**: tablero por etapas con canal, vendedor, seguimiento y conversión a reserva o venta.
- **Ventas**: parte de pago, crédito con financiera y estado de la transferencia.
- **Rentabilidad por unidad**: precio − compra − reacondicionamiento − comisión − IVA − costo del capital por días en patio.
- **Centro de control** por rol (Gerencia, Administración, Vendedor), con motor de reglas AU-001 a AU-015 configurable.

## Uso
Abrir `index.html` en el navegador. No requiere instalación. Los datos se guardan en el `localStorage` del navegador; exporta respaldos desde Configuración.

> El tratamiento del IVA y el texto del contrato de consignación son referenciales: valídalos con tu contador y tu abogado.
