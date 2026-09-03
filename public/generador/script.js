/* ============================================================================
   DIDIAL · Generador de Piezas Publicitarias
   script.js — Catálogo de imágenes y datos + lógica de la aplicación
   ----------------------------------------------------------------------------
   ASSETS: mapa clave -> ruta relativa de archivo en /images (antes venían
   embebidos como data URLs base64 dentro del HTML). El resto del código
   funciona igual, ya que <img src> e Image().src aceptan tanto data URLs
   como rutas relativas. Al subir una foto nueva desde el panel de Recursos
   o Vehículos, ASSETS[key] se sobreescribe en memoria con un data URL nuevo
   (igual que antes); el respaldo/backup JSON sigue exportando el estado
   actual de ASSETS tal cual esté en ese momento.
   CATALOGO: modelos y vehículos del catálogo (antes embebido en el HTML).
   ============================================================================ */

const ASSETS = {"logo_toyota":"images/logo_toyota.webp","logo_mazda":"images/logo_mazda.webp","logo_nissan":"images/logo_nissan.webp","veh_hilux":"images/veh_hilux.webp","veh_bt50":"images/veh_bt50.webp","veh_np300":"images/veh_np300.webp","logo_didial_blanco":"images/logo_didial_blanco.webp","logo_didial_color":"images/logo_didial_color.webp","veh_cx5":"images/veh_cx5.webp","veh_cx3":"images/veh_cx3.webp","veh_mazda6":"images/veh_mazda6.webp","veh_mazda3_sedan":"images/veh_mazda3_sedan.webp","veh_mazda3_hb":"images/veh_mazda3_hb.webp","veh_rav4":"images/veh_rav4.webp","veh_xo7hyvpi":"images/veh_xo7hyvpi.webp","veh_xwbxz9v7":"images/veh_xwbxz9v7.webp","veh_xfrahvmz":"images/veh_xfrahvmz.webp","veh_x7trolh2":"images/veh_x7trolh2.webp","veh_xyj0fhgn":"images/veh_xyj0fhgn.webp","veh_x911n12s":"images/veh_x911n12s.webp","veh_xe7hd7m0":"images/veh_xe7hd7m0.webp","veh_xj75ttre":"images/veh_xj75ttre.webp","veh_xbks1go0":"images/veh_xbks1go0.webp","veh_x3rma0tt":"images/veh_x3rma0tt.webp","veh_x68aua2a":"images/veh_x68aua2a.webp","veh_xpk2e4sx":"images/veh_xpk2e4sx.webp","veh_xdbqn7e6":"images/veh_xdbqn7e6.webp","veh_x82zd3t8":"images/veh_x82zd3t8.webp","veh_xva7jvr8":"images/veh_xva7jvr8.webp","veh_x33s4erw":"images/veh_x33s4erw.webp","veh_xeglkzr4":"images/veh_xeglkzr4.webp","veh_x1rjmr2w":"images/veh_x1rjmr2w.webp","veh_xx112qlt":"images/veh_xx112qlt.webp","veh_xdpykxx7":"images/veh_xdpykxx7.webp","veh_xl5iey1q":"images/veh_xl5iey1q.webp","veh_xuf1z3ym":"images/veh_xuf1z3ym.webp","veh_x84lezkd":"images/veh_x84lezkd.webp","veh_xbu7sydv":"images/veh_xbu7sydv.webp","veh_x7ihr21f":"images/veh_x7ihr21f.webp","veh_xz272wo5":"images/veh_xz272wo5.webp","veh_xr9aqehb":"images/veh_xr9aqehb.webp","veh_xbqopc4h":"images/veh_xbqopc4h.webp","veh_xhq6o1do":"images/veh_xhq6o1do.webp","veh_xtcwj3r4":"images/veh_xtcwj3r4.webp","veh_x4k6li3l":"images/veh_x4k6li3l.webp","veh_xse7vhe5":"images/veh_xse7vhe5.webp","veh_xcex4m3t":"images/veh_xcex4m3t.webp","veh_x8o8f5o8":"images/veh_x8o8f5o8.webp","veh_x5kn2jj7":"images/veh_x5kn2jj7.webp"};

const CATALOGO = {"modelos":[{"id":"md-toyota-4runner-n180","marca_id":"m1","nombre":"4Runner N180","categoria":"suv-grande","imagen":"veh_xeglkzr4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-4runner-n210","marca_id":"m1","nombre":"4Runner N210","categoria":"suv-grande","imagen":"veh_xeglkzr4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-4runner-n280","marca_id":"m1","nombre":"4Runner N280","categoria":"suv-grande","imagen":"veh_xeglkzr4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-agya","marca_id":"m1","nombre":"Agya","categoria":"auto-4l","imagen":"veh_xwbxz9v7","orientacion":"derecha","parcheModo":"restaurar","parche":{"x":0.77,"y":0.52,"w":0.15,"h":0.1},"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-camry-xv20","marca_id":"m1","nombre":"Camry XV20","categoria":"auto-5l","imagen":"veh_xva7jvr8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-camry-xv30","marca_id":"m1","nombre":"Camry XV30","categoria":"auto-5l","imagen":"veh_xva7jvr8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-camry-xv40","marca_id":"m1","nombre":"Camry XV40","categoria":"auto-5l","imagen":"veh_xva7jvr8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-camry-xv70-hibrido","marca_id":"m1","nombre":"Camry XV70 Híbrido","categoria":"auto-5l","imagen":"veh_xva7jvr8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-corolla","marca_id":"m1","nombre":"Corolla","categoria":"auto-5l","imagen":"veh_x1rjmr2w","orientacion":"derecha","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-corolla-cross","marca_id":"m1","nombre":"Corolla Cross","categoria":"suv-normal","imagen":"veh_xcex4m3t","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-corolla-cross-hibrido","marca_id":"m1","nombre":"Corolla Cross Híbrido","categoria":"suv-normal","imagen":"veh_x8o8f5o8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-corolla-hibrido","marca_id":"m1","nombre":"Corolla Híbrido","categoria":"auto-5l","imagen":"veh_x1rjmr2w","orientacion":"derecha","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-hiace-h100","marca_id":"m1","nombre":"Hiace H100","categoria":"suv-grande","imagen":"veh_x82zd3t8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-hiace-h200","marca_id":"m1","nombre":"Hiace H200","categoria":"suv-grande","imagen":"veh_x82zd3t8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-hiace-h300","marca_id":"m1","nombre":"Hiace H300","categoria":"suv-grande","imagen":"veh_x82zd3t8","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-hilux","marca_id":"m1","nombre":"Hilux","categoria":"pickup","imagen":"veh_hilux","orientacion":"derecha","parcheModo":"restaurar","parche":{"x":0.775,"y":0.535,"w":0.135,"h":0.11},"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-land-cruiser-prado-120","marca_id":"m1","nombre":"Land Cruiser Prado 120","categoria":"suv-grande","imagen":"veh_xtcwj3r4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-land-cruiser-prado-150","marca_id":"m1","nombre":"Land Cruiser Prado 150","categoria":"suv-grande","imagen":"veh_xtcwj3r4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-land-cruiser-prado-250","marca_id":"m1","nombre":"Land Cruiser Prado 250","categoria":"suv-grande","imagen":"veh_xtcwj3r4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-land-cruiser-prado-90","marca_id":"m1","nombre":"Land Cruiser Prado 90","categoria":"suv-grande","imagen":"veh_xtcwj3r4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-rav4","marca_id":"m1","nombre":"RAV4","categoria":"suv-normal","imagen":"veh_rav4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-rav4-hibrido","marca_id":"m1","nombre":"RAV4 Híbrido","categoria":"suv-normal","imagen":"veh_rav4","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-urban-cruiser","marca_id":"m1","nombre":"Urban Cruiser","categoria":"suv-normal","imagen":"veh_xx112qlt","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-yaris-echo","marca_id":"m1","nombre":"Yaris Echo","categoria":"auto-4l","imagen":"veh_xdbqn7e6","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-yaris-sedan-liftback","marca_id":"m1","nombre":"Yaris Sedan / Liftback","categoria":"auto-4l","imagen":"veh_x7ihr21f","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-yaris-sport-sedan","marca_id":"m1","nombre":"Yaris Sport","categoria":"auto-4l","imagen":"veh_xdbqn7e6","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-2","marca_id":"m2","nombre":"2","categoria":"auto-4l","imagen":"veh_xdpykxx7","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-3","marca_id":"m2","nombre":"3 Sedán","categoria":"auto-5l","imagen":"veh_mazda3_sedan","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-3-sport","marca_id":"m2","nombre":"3 Sport (Hatchback)","categoria":"auto-5l","imagen":"veh_mazda3_hb","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-6","marca_id":"m2","nombre":"6","categoria":"auto-5l","imagen":"veh_mazda6","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-bt-50","marca_id":"m2","nombre":"BT-50","categoria":"pickup","imagen":"veh_bt50","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-3","marca_id":"m2","nombre":"CX-3","categoria":"suv-normal","imagen":"veh_cx3","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-30","marca_id":"m2","nombre":"CX-30","categoria":"suv-normal","imagen":"veh_xl5iey1q","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-5","marca_id":"m2","nombre":"CX-5","categoria":"suv-normal","imagen":"veh_cx5","orientacion":"derecha","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-60","marca_id":"m2","nombre":"CX-60","categoria":"suv-grande","imagen":"veh_xuf1z3ym","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-9","marca_id":"m2","nombre":"CX-9","categoria":"suv-grande","imagen":"veh_xse7vhe5","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-cx-90","marca_id":"m2","nombre":"CX-90","categoria":"suv-grande","imagen":"veh_xbu7sydv","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-mazda-mx-5","marca_id":"m2","nombre":"MX-5","categoria":"auto-5l","imagen":"veh_x84lezkd","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-juke","marca_id":"m3","nombre":"Juke","categoria":"suv-normal","imagen":"veh_xfrahvmz","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-kicks","marca_id":"m3","nombre":"Kicks","categoria":"suv-normal","imagen":"veh_xr9aqehb","orientacion":"derecha","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-march","marca_id":"m3","nombre":"March","categoria":"auto-4l","imagen":"veh_xe7hd7m0","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-murano","marca_id":"m3","nombre":"Murano","categoria":"suv-grande","imagen":"veh_xyj0fhgn","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-nv350-urvan","marca_id":"m3","nombre":"NV350 / Urvan","categoria":"suv-grande","imagen":"veh_x7trolh2","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-navara-np300","marca_id":"m3","nombre":"Navara / NP300","categoria":"pickup","imagen":"veh_np300","orientacion":"derecha","parcheModo":"restaurar","parche":{"x":0.77,"y":0.5,"w":0.16,"h":0.115},"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-pathfinder","marca_id":"m3","nombre":"Pathfinder","categoria":"suv-grande","imagen":"veh_x911n12s","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-qashqai","marca_id":"m3","nombre":"Qashqai","categoria":"suv-normal","imagen":"veh_xo7hyvpi","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-sentra","marca_id":"m3","nombre":"Sentra","categoria":"auto-5l","imagen":"veh_xbqopc4h","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-terrano-pickup","marca_id":"m3","nombre":"Terrano","categoria":"suv-normal","imagen":"veh_xpk2e4sx","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-tiida","marca_id":"m3","nombre":"Tiida","categoria":"auto-4l","imagen":"veh_xj75ttre","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-versa","marca_id":"m3","nombre":"Versa","categoria":"auto-5l","imagen":"veh_xz272wo5","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-x-trail","marca_id":"m3","nombre":"X-Trail","categoria":"suv-normal","imagen":"veh_xhq6o1do","orientacion":"derecha","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-rush","marca_id":"m1","nombre":"Rush","categoria":"suv-normal","imagen":"veh_xbks1go0","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-tundra","marca_id":"m1","nombre":"Tundra","categoria":"pickup","imagen":"veh_x3rma0tt","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-nissan-frontier","marca_id":"m3","nombre":"Frontier","categoria":"pickup","imagen":"veh_x68aua2a","orientacion":"izquierda","parcheModo":"restaurar","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-generico-pickup","marca_id":"m4","nombre":"Pick Up","categoria":"pickup","generico":true,"imagen":"veh_x33s4erw","orientacion":"izquierda","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-generico-suv-grande","marca_id":"m4","nombre":"SUV Grande","categoria":"suv-grande","generico":true,"imagen":"veh_x33s4erw","orientacion":"izquierda","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-generico-suv-normal","marca_id":"m4","nombre":"SUV Normal","categoria":"suv-normal","generico":true,"imagen":"veh_x33s4erw","orientacion":"izquierda","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-generico-auto-5l","marca_id":"m4","nombre":"Auto 5L","categoria":"auto-5l","generico":true,"imagen":"veh_x33s4erw","orientacion":"izquierda","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-generico-auto-4l","marca_id":"m4","nombre":"Auto 4L","categoria":"auto-4l","generico":true,"imagen":"veh_x33s4erw","orientacion":"izquierda","parcheModo":"ninguno","parche":null,"escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-fortuner","marca_id":"m1","nombre":"Fortuner","categoria":"suv-grande","imagen":"veh_x4k6li3l","orientacion":"izquierda","escala":1,"offx":0,"offy":0,"activo":true},{"id":"md-toyota-raize","marca_id":"m1","nombre":"Raize","categoria":"suv-normal","imagen":"veh_x5kn2jj7","orientacion":"izquierda","escala":1,"offx":0,"offy":0,"activo":true}],"vehiculos":[{"id":"v1","modelo_id":"md-mazda-2","cilindrada":"1.5","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v2","modelo_id":"md-mazda-2","cilindrada":"1.5","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v3","modelo_id":"md-mazda-2","cilindrada":"1.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v4","modelo_id":"md-mazda-2","cilindrada":"1.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v5","modelo_id":"md-mazda-3","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v6","modelo_id":"md-mazda-3","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v7","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v8","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"","activo":true},{"id":"v9","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v10","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v11","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v12","modelo_id":"md-mazda-3","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v13","modelo_id":"md-mazda-3","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v14","modelo_id":"md-mazda-6","cilindrada":"2.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v15","modelo_id":"md-mazda-6","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 5vel","traccion":"","activo":true},{"id":"v16","modelo_id":"md-mazda-6","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v17","modelo_id":"md-mazda-cx-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v18","modelo_id":"md-mazda-cx-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v19","modelo_id":"md-mazda-cx-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v20","modelo_id":"md-mazda-cx-3","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v21","modelo_id":"md-mazda-cx-30","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v22","modelo_id":"md-mazda-cx-30","cilindrada":"2.5","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v23","modelo_id":"md-mazda-cx-30","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v24","modelo_id":"md-mazda-cx-30","cilindrada":"2.5","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v25","modelo_id":"md-mazda-cx-30","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v26","modelo_id":"md-mazda-cx-30","cilindrada":"2.5","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v27","modelo_id":"md-mazda-cx-30","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v28","modelo_id":"md-mazda-cx-30","cilindrada":"2.5","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v29","modelo_id":"md-mazda-cx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v30","modelo_id":"md-mazda-cx-5","cilindrada":"2.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v31","modelo_id":"md-mazda-cx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v32","modelo_id":"md-mazda-cx-5","cilindrada":"2.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v33","modelo_id":"md-mazda-cx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v34","modelo_id":"md-mazda-cx-5","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v35","modelo_id":"md-mazda-cx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v36","modelo_id":"md-mazda-cx-5","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v37","modelo_id":"md-mazda-cx-5","cilindrada":"2.2","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v38","modelo_id":"md-mazda-cx-9","cilindrada":"3.7","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v39","modelo_id":"md-mazda-cx-9","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v40","modelo_id":"md-mazda-cx-60","cilindrada":"3.3","combustible":"Gasolina MHEV / PHEV","transmision":"AT 8vel","traccion":"4x4","activo":true},{"id":"v41","modelo_id":"md-mazda-cx-60","cilindrada":"2.5","combustible":"Gasolina MHEV / PHEV","transmision":"AT 8vel","traccion":"4x4","activo":true},{"id":"v42","modelo_id":"md-mazda-cx-90","cilindrada":"3.3","combustible":"Gasolina MHEV","transmision":"AT 8vel","traccion":"4x4","activo":true},{"id":"v43","modelo_id":"md-mazda-bt-50","cilindrada":"2.2","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v44","modelo_id":"md-mazda-bt-50","cilindrada":"3.2","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v45","modelo_id":"md-mazda-bt-50","cilindrada":"2.2","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v46","modelo_id":"md-mazda-bt-50","cilindrada":"3.2","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v47","modelo_id":"md-mazda-bt-50","cilindrada":"2.2","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v48","modelo_id":"md-mazda-bt-50","cilindrada":"3.2","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v49","modelo_id":"md-mazda-bt-50","cilindrada":"2.2","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v50","modelo_id":"md-mazda-bt-50","cilindrada":"3.2","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v51","modelo_id":"md-mazda-bt-50","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v52","modelo_id":"md-mazda-bt-50","cilindrada":"1.9","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v53","modelo_id":"md-mazda-bt-50","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v54","modelo_id":"md-mazda-bt-50","cilindrada":"1.9","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v55","modelo_id":"md-mazda-bt-50","cilindrada":"3.0","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v56","modelo_id":"md-mazda-bt-50","cilindrada":"1.9","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v57","modelo_id":"md-mazda-bt-50","cilindrada":"3.0","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v58","modelo_id":"md-mazda-bt-50","cilindrada":"1.9","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v59","modelo_id":"md-mazda-mx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v60","modelo_id":"md-mazda-mx-5","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v61","modelo_id":"md-nissan-navara-np300","cilindrada":"2.3","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v62","modelo_id":"md-nissan-navara-np300","cilindrada":"2.3","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v63","modelo_id":"md-nissan-navara-np300","cilindrada":"2.3","combustible":"Diésel","transmision":"AT 7vel","traccion":"4x4","activo":true},{"id":"v67","modelo_id":"md-nissan-qashqai","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v68","modelo_id":"md-nissan-qashqai","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v69","modelo_id":"md-nissan-qashqai","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v70","modelo_id":"md-nissan-qashqai","cilindrada":"1.3","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v71","modelo_id":"md-nissan-qashqai","cilindrada":"1.3","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v72","modelo_id":"md-nissan-qashqai","cilindrada":"1.3","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v73","modelo_id":"md-nissan-x-trail","cilindrada":"2.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v74","modelo_id":"md-nissan-x-trail","cilindrada":"2.5","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v75","modelo_id":"md-nissan-x-trail","cilindrada":"2.5","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v76","modelo_id":"md-nissan-x-trail","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v77","modelo_id":"md-nissan-x-trail","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v78","modelo_id":"md-nissan-x-trail","cilindrada":"2.5","combustible":"Gasolina","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v79","modelo_id":"md-nissan-kicks","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v80","modelo_id":"md-nissan-kicks","cilindrada":"1.6","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v81","modelo_id":"md-nissan-versa","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v82","modelo_id":"md-nissan-versa","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v83","modelo_id":"md-nissan-versa","cilindrada":"1.6","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v84","modelo_id":"md-nissan-sentra","cilindrada":"1.8","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v85","modelo_id":"md-nissan-sentra","cilindrada":"1.8","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v86","modelo_id":"md-nissan-sentra","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v87","modelo_id":"md-nissan-sentra","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v88","modelo_id":"md-nissan-tiida","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v89","modelo_id":"md-nissan-tiida","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v90","modelo_id":"md-nissan-march","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v91","modelo_id":"md-nissan-march","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v92","modelo_id":"md-nissan-terrano-pickup","cilindrada":"2.4","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v93","modelo_id":"md-nissan-terrano-pickup","cilindrada":"2.4","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v94","modelo_id":"md-nissan-terrano-pickup","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v95","modelo_id":"md-nissan-terrano-pickup","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v96","modelo_id":"md-nissan-pathfinder","cilindrada":"3.5","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v97","modelo_id":"md-nissan-pathfinder","cilindrada":"3.5","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v98","modelo_id":"md-nissan-murano","cilindrada":"3.5","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v99","modelo_id":"md-nissan-nv350-urvan","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v100","modelo_id":"md-nissan-juke","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v101","modelo_id":"md-nissan-juke","cilindrada":"1.6","combustible":"Gasolina","transmision":"CVT","traccion":"4x4","activo":true},{"id":"v102","modelo_id":"md-toyota-yaris-echo","cilindrada":"1.3","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v103","modelo_id":"md-toyota-yaris-echo","cilindrada":"1.3","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v104","modelo_id":"md-toyota-yaris-echo","cilindrada":"1.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v105","modelo_id":"md-toyota-yaris-sedan-liftback","cilindrada":"1.3","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v106","modelo_id":"md-toyota-yaris-sedan-liftback","cilindrada":"1.5","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v107","modelo_id":"md-toyota-yaris-sedan-liftback","cilindrada":"1.5","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v108","modelo_id":"md-toyota-yaris-sport-sedan","cilindrada":"1.5","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v109","modelo_id":"md-toyota-yaris-sport-sedan","cilindrada":"1.5","combustible":"Gasolina","transmision":"CVT 7vel","traccion":"","activo":true},{"id":"v110","modelo_id":"md-toyota-yaris-sport-sedan","cilindrada":"1.3","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v113","modelo_id":"md-toyota-corolla","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v114","modelo_id":"md-toyota-corolla","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v115","modelo_id":"md-toyota-corolla","cilindrada":"1.8","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v116","modelo_id":"md-toyota-corolla","cilindrada":"1.8","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v117","modelo_id":"md-toyota-corolla","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v118","modelo_id":"md-toyota-corolla","cilindrada":"1.8","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v119","modelo_id":"md-toyota-corolla","cilindrada":"1.8","combustible":"Gasolina","transmision":"CVT 7vel","traccion":"","activo":true},{"id":"v120","modelo_id":"md-toyota-corolla","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT 10vel","traccion":"","activo":true},{"id":"v121","modelo_id":"md-toyota-corolla-hibrido","cilindrada":"1.8","combustible":"Gasolina","transmision":"eCVT","traccion":"","activo":true},{"id":"v122","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v123","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 4vel","traccion":"4x4","activo":true},{"id":"v124","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v125","modelo_id":"md-toyota-rav4","cilindrada":"2.4","combustible":"Gasolina","transmision":"AT 4vel","traccion":"4x4","activo":true},{"id":"v126","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v127","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT 7vel","traccion":"4x4","activo":true},{"id":"v128","modelo_id":"md-toyota-rav4","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v129","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT 10vel","traccion":"","activo":true},{"id":"v130","modelo_id":"md-toyota-rav4","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT 10vel","traccion":"4x4","activo":true},{"id":"v131","modelo_id":"md-toyota-rav4-hibrido","cilindrada":"2.5","combustible":"Gasolina","transmision":"eCVT","traccion":"","activo":true},{"id":"v132","modelo_id":"md-toyota-rav4-hibrido","cilindrada":"2.5","combustible":"Gasolina","transmision":"eCVT","traccion":"4x4","activo":true},{"id":"v133","modelo_id":"md-toyota-hilux","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v134","modelo_id":"md-toyota-hilux","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v135","modelo_id":"md-toyota-hilux","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v136","modelo_id":"md-toyota-hilux","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v137","modelo_id":"md-toyota-hilux","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v138","modelo_id":"md-toyota-hilux","cilindrada":"3.0","combustible":"Diésel","transmision":"AT 5vel","traccion":"4x4","activo":true},{"id":"v139","modelo_id":"md-toyota-hilux","cilindrada":"2.4","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v140","modelo_id":"md-toyota-hilux","cilindrada":"2.4","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v141","modelo_id":"md-toyota-hilux","cilindrada":"2.8","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v142","modelo_id":"md-toyota-hilux","cilindrada":"2.8","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v143","modelo_id":"md-toyota-land-cruiser-prado-90","cilindrada":"3.4","combustible":"Gasolina","transmision":"AT 4vel","traccion":"4x4","activo":true},{"id":"v144","modelo_id":"md-toyota-land-cruiser-prado-90","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x4","activo":true},{"id":"v145","modelo_id":"md-toyota-land-cruiser-prado-90","cilindrada":"3.0","combustible":"Diésel","transmision":"AT 4vel","traccion":"4x4","activo":true},{"id":"v146","modelo_id":"md-toyota-land-cruiser-prado-120","cilindrada":"4.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"4x4","activo":true},{"id":"v147","modelo_id":"md-toyota-land-cruiser-prado-120","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x4","activo":true},{"id":"v148","modelo_id":"md-toyota-land-cruiser-prado-120","cilindrada":"3.0","combustible":"Diésel","transmision":"AT 5vel","traccion":"4x4","activo":true},{"id":"v149","modelo_id":"md-toyota-land-cruiser-prado-150","cilindrada":"4.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v150","modelo_id":"md-toyota-land-cruiser-prado-150","cilindrada":"2.8","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v151","modelo_id":"md-toyota-land-cruiser-prado-250","cilindrada":"2.8","combustible":"Diésel","transmision":"AT 8vel","traccion":"4x4","activo":true},{"id":"v152","modelo_id":"md-toyota-land-cruiser-prado-250","cilindrada":"2.4","combustible":"Gasolina","transmision":"AT 8vel","traccion":"4x4","activo":true},{"id":"v153","modelo_id":"md-toyota-4runner-n180","cilindrada":"3.4","combustible":"Gasolina","transmision":"AT 4vel","traccion":"4x4","activo":true},{"id":"v154","modelo_id":"md-toyota-4runner-n210","cilindrada":"4.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"4x4","activo":true},{"id":"v155","modelo_id":"md-toyota-4runner-n280","cilindrada":"4.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"4x4","activo":true},{"id":"v156","modelo_id":"md-toyota-camry-xv20","cilindrada":"2.2","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v157","modelo_id":"md-toyota-camry-xv20","cilindrada":"3.0","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v158","modelo_id":"md-toyota-camry-xv30","cilindrada":"2.4","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v159","modelo_id":"md-toyota-camry-xv30","cilindrada":"3.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"","activo":true},{"id":"v160","modelo_id":"md-toyota-camry-xv40","cilindrada":"2.4","combustible":"Gasolina","transmision":"AT 5vel","traccion":"","activo":true},{"id":"v161","modelo_id":"md-toyota-camry-xv40","cilindrada":"3.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v162","modelo_id":"md-toyota-camry-xv70-hibrido","cilindrada":"2.5","combustible":"Gasolina","transmision":"eCVT","traccion":"","activo":true},{"id":"v163","modelo_id":"md-toyota-corolla-cross","cilindrada":"2.0","combustible":"Gasolina","transmision":"CVT 10vel","traccion":"","activo":true},{"id":"v164","modelo_id":"md-toyota-corolla-cross-hibrido","cilindrada":"1.8","combustible":"Gasolina","transmision":"eCVT","traccion":"","activo":true},{"id":"v165","modelo_id":"md-toyota-hiace-h100","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v166","modelo_id":"md-toyota-hiace-h100","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v167","modelo_id":"md-toyota-hiace-h200","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v168","modelo_id":"md-toyota-hiace-h200","cilindrada":"3.0","combustible":"Diésel","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v169","modelo_id":"md-toyota-hiace-h300","cilindrada":"2.8","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v170","modelo_id":"md-toyota-hiace-h300","cilindrada":"2.8","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v171","modelo_id":"md-toyota-urban-cruiser","cilindrada":"1.3","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v172","modelo_id":"md-toyota-agya","cilindrada":"1.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v173","modelo_id":"md-toyota-agya","cilindrada":"1.2","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v174","modelo_id":"md-toyota-agya","cilindrada":"1.2","combustible":"Gasolina","transmision":"CVT","traccion":"","activo":true},{"id":"v175","modelo_id":"md-mazda-3-sport","cilindrada":"1.6","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v176","modelo_id":"md-mazda-3-sport","cilindrada":"1.6","combustible":"Gasolina","transmision":"AT 4vel","traccion":"","activo":true},{"id":"v177","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 5vel","traccion":"","activo":true},{"id":"v178","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 5vel","traccion":"","activo":true},{"id":"v179","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v180","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v181","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"MT 6vel","traccion":"","activo":true},{"id":"v182","modelo_id":"md-mazda-3-sport","cilindrada":"2.0","combustible":"Gasolina / MHEV","transmision":"AT 6vel","traccion":"","activo":true},{"id":"v183","modelo_id":"md-mazda-3-sport","cilindrada":"2.5","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v184","modelo_id":"md-toyota-rush","cilindrada":"1.5","combustible":"Gasolina","transmision":"MT 5vel","traccion":"4x2","activo":true},{"id":"v185","modelo_id":"md-toyota-tundra","cilindrada":"4.6","combustible":"Gasolina","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v186","modelo_id":"md-nissan-frontier","cilindrada":"2.5","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v187","modelo_id":"md-generico-pickup","cilindrada":"","combustible":"Diésel","transmision":"","traccion":"","activo":true},{"id":"v188","modelo_id":"md-generico-pickup","cilindrada":"","combustible":"Gasolina","transmision":"","traccion":"","activo":true},{"id":"v189","modelo_id":"md-generico-suv-grande","cilindrada":"","combustible":"Diésel","transmision":"","traccion":"","activo":true},{"id":"v190","modelo_id":"md-generico-suv-grande","cilindrada":"","combustible":"Gasolina","transmision":"","traccion":"","activo":true},{"id":"v191","modelo_id":"md-generico-suv-normal","cilindrada":"","combustible":"Gasolina","transmision":"","traccion":"","activo":true},{"id":"v192","modelo_id":"md-generico-auto-5l","cilindrada":"","combustible":"Gasolina","transmision":"","traccion":"","activo":true},{"id":"v193","modelo_id":"md-generico-auto-4l","cilindrada":"","combustible":"Gasolina","transmision":"","traccion":"","activo":true},{"id":"v194","modelo_id":"md-toyota-fortuner","cilindrada":"2.4","combustible":"Diésel","transmision":"MT 6vel","traccion":"4x2","activo":true},{"id":"v195","modelo_id":"md-toyota-fortuner","cilindrada":"2.4","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x2","activo":true},{"id":"v196","modelo_id":"md-toyota-fortuner","cilindrada":"2.4","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v197","modelo_id":"md-toyota-fortuner","cilindrada":"2.8","combustible":"Diésel","transmision":"AT 6vel","traccion":"4x4","activo":true},{"id":"v198","modelo_id":"md-toyota-raize","cilindrada":"1.0 Turbo","combustible":"Gasolina","transmision":"CVT","traccion":"4x2","activo":true}]};

/* ============================================================================
   DIDIAL · Generador de Piezas Publicitarias
   Motor de composición programática · 1080 x 1350 (4:5)
   ========================================================================== */

const W = 1080, H = 1350;

/* ---------------------------------------------------------------- LAYOUTS */
const IDENTIDAD = { amarillo: '#FFD100', rojo: '#E03A2F', blanco: '#FFFFFF' };

/* Paleta base para layouts oscuros. Cada marca sólo sobreescribe lo suyo. */
const PALETA_OSCURA = {
  titulo: '#FFFFFF', destacado: IDENTIDAD.amarillo, bajada: '#C8CDD4',
  grupoTitulo: IDENTIDAD.amarillo, item: '#EEF0F4',
  chipBg: null, chipTexto: '#FFFFFF',            // chipBg null = usa el acento
  bandaBg: IDENTIDAD.amarillo, bandaTexto: '#0F0F0F',
  precioBg: IDENTIDAD.amarillo, precioTexto: '#0F0F0F',
  precioLabel: '#463400', precioAntes: '#695000', precioBorde: null,
  gratisTitulo: null, gratisTexto: '#FFFFFF', vigencia: '#969BA2',
  pieBg: '#000000', pieCta: IDENTIDAD.amarillo, pieTexto: '#FFFFFF',
  sombraVehiculo: 'rgba(0,0,0,0.55)', logoPlaca: null
};

const LAYOUTS = {
  /* TOYOTA — rojo característico sobre carbón */
  toyota: {
    slug: 'toyota', nombre: 'Toyota', tema: 'oscuro',
    acento: '#EB0A1E', logoVariante: 'blanco', vineta: 0.46,
    fondo: { tipo: 'velocidad', base: '#3A414F', base2: '#1E2430',
             trazo: '235,20,40', glow: '#E0263C', intensidad: 0.58 },
    scrim: { color: '0,0,0', global: 0.10, servicios: 0.34, titular: 0.26 },
    paleta: { ...PALETA_OSCURA }
  },

  /* NISSAN — tonalidades grises, acero y plata */
  nissan: {
    slug: 'nissan', nombre: 'Nissan', tema: 'oscuro',
    acento: '#AEB7C2', logoVariante: 'blanco', vineta: 0.42,
    fondo: { tipo: 'acero', base: '#4A525E', base2: '#252A33',
             trazo: '225,232,240', glow: '#A9B3BF', intensidad: 0.46 },
    scrim: { color: '0,0,0', global: 0.10, servicios: 0.34, titular: 0.26 },
    paleta: {
      ...PALETA_OSCURA,
      bajada: '#B3BAC4',
      chipBg: '#3B434E', chipTexto: '#F1F4F8',
      gratisTitulo: '#C7CED8',
      item: '#E7EAEF',
      sombraVehiculo: 'rgba(0,0,0,0.6)'
    }
  },

  /* MAZDA — blancos de invierno, fondo claro */
  mazda: {
    slug: 'mazda', nombre: 'Mazda', tema: 'claro',
    acento: '#41586E', logoVariante: 'color', vineta: 0.42,
    fondo: { tipo: 'invierno', base: '#FFFFFF', base2: '#D9E3EE',
             trazo: '255,255,255', glow: '#FFFFFF', intensidad: 0.85 },
    scrim: { color: '255,255,255', global: 0.08, servicios: 0.30, titular: 0.24 },
    paleta: {
      titulo: '#101C28', destacado: '#26445E', bajada: '#5A6B7C',
      grupoTitulo: '#1B3348', item: '#26333F',
      chipBg: '#12202E', chipTexto: '#FFFFFF',
      bandaBg: IDENTIDAD.amarillo, bandaTexto: '#0F0F0F',
      precioBg: IDENTIDAD.amarillo, precioTexto: '#0F0F0F',
      precioLabel: '#5A4600', precioAntes: '#6E5600', precioBorde: 'rgba(0,0,0,0.14)',
      gratisTitulo: null, gratisTexto: '#26333F', vigencia: '#7C8B99',
      pieBg: '#0E1621', pieCta: IDENTIDAD.amarillo, pieTexto: '#FFFFFF',
      sombraVehiculo: 'rgba(22,40,62,0.38)',
      logoPlaca: null   // la variante a color del logo ya contrasta sobre fondo claro
    }
  },

  /* GENÉRICO — piezas por tipo de vehículo, sin marca ni modelo. Fondo propio
     (grilla técnica de taller) e identidad 100% Didial (amarillo), para no
     parecerse a ninguno de los tres fondos de marca de arriba. */
  generico: {
    slug: 'generico', nombre: 'Genérico', tema: 'oscuro',
    acento: IDENTIDAD.amarillo, logoVariante: 'blanco', vineta: 0.48,
    fondo: { tipo: 'taller', base: '#262b33', base2: '#12151a',
             trazo: '255,209,0', glow: '#FFD100', intensidad: 0.5 },
    scrim: { color: '0,0,0', global: 0.10, servicios: 0.34, titular: 0.26 },
    paleta: { ...PALETA_OSCURA }
  }
};

/* --------------------------------------------------------- DATOS SEMILLA */
/* Tarifario tomado de Lista_de_precios.xlsx: categoría × combustible × repuesto.
   El diésel cuesta más porque incluye cambio de filtro de combustible; en
   bencinero ese filtro no se cambia y el de polen sólo se inspecciona. */
// Tarifario de "Pack Mantención 360°" (vehículos de marca real: Toyota/Mazda/Nissan).
// Fuente: 1787769279037_Pack mantención 360.xlsx
const TARIFAS_360 = {
  'pickup':     { 'Diésel': { alt: 268900, orig: 421400 }, 'Gasolina': { alt: 227900, orig: 330400 } },
  'suv-grande': { 'Diésel': { alt: 268900, orig: 421400 }, 'Gasolina': { alt: 227900, orig: 330400 } },
  'suv-normal': { 'Gasolina': { alt: 205900, orig: 332400 } },
  'auto-5l':    { 'Gasolina': { alt: 205900, orig: 332400 } },
  'auto-4l':    { 'Gasolina': { alt: 193900, orig: 332400 } }
};

// Tarifario de "Pack mantención Pro" (piezas genéricas, sin marca/modelo).
// Fuente: Precios genericos.xlsx
const TARIFAS_GENERICO = {
  'pickup':     { 'Diésel': { alt: 326500, orig: 511700 }, 'Gasolina': { alt: 276900, orig: 401200 } },
  'suv-grande': { 'Diésel': { alt: 326500, orig: 511700 }, 'Gasolina': { alt: 276900, orig: 401200 } },
  'suv-normal': { 'Gasolina': { alt: 250000, orig: 403700 } },
  'auto-5l':    { 'Gasolina': { alt: 250000, orig: 403700 } },
  'auto-4l':    { 'Gasolina': { alt: 235500, orig: 403700 } }
};

const CATEGORIAS = {
  'pickup': 'Pick Up', 'suv-grande': 'SUV Grande', 'suv-normal': 'SUV Normal',
  'auto-5l': 'Auto 5L', 'auto-4l': 'Auto 4L'
};

/* Un servicio puede aplicar sólo a un combustible:
     [D] ...  → sólo diésel      [G] ...  → sólo bencinero
   Sin prefijo aplica a ambos. */
function esDe(txt, combustible) {
  const m = /^\s*\[([DG])\]\s*/i.exec(txt);
  if (!m) return true;
  const diesel = /diésel|diesel/i.test(combustible || '');
  return m[1].toUpperCase() === 'D' ? diesel : !diesel;
}
function sinPrefijo(txt) { return txt.replace(/^\s*\[[DG]\]\s*/i, ''); }

const DB = {
  marcas: [
    { id: 'm1', nombre: 'Toyota', slug: 'toyota', logo: 'logo_toyota', layout: 'toyota', activo: true },
    { id: 'm2', nombre: 'Mazda',  slug: 'mazda',  logo: 'logo_mazda',  layout: 'mazda',  activo: true },
    { id: 'm3', nombre: 'Nissan', slug: 'nissan', logo: 'logo_nissan', layout: 'nissan', activo: true },
    // Pseudo-marca para piezas genéricas: sin logo de marca, layout propio.
    { id: 'm4', nombre: 'Genérico', slug: 'generico', logo: null, layout: 'generico', activo: true }
  ],
  // La imagen, la orientación y el parche viven en el MODELO: una foto sirve
  // para todas sus cilindradas.
  modelos: CATALOGO.modelos,
  vehiculos: CATALOGO.vehiculos,
  campanas: [
    { id: 'c1', nombre: 'Pack Mantención 360°', titulo: 'PACK MANTENCIÓN', subtitulo: '360°',
      bajada: 'Mantención preventiva + inspección integral',
      descuento: 30, precio_oferta: 268900,
      tarifa: { usar: true, repuesto: 'alt' },
      urgencia: 'SOLO POR ESTE MES', cta: 'AGENDA TU HORA',
      vigencia: '2026-08-31',
      servicios: {
        CAMBIAR: ['Filtro de aceite', 'Aceite motor', 'Golilla tapón de cárter',
                  'Filtro de aire', '[D] Filtro de polen', '[D] Filtro de combustible'],
        REALIZAR: ['Revisión y relleno de niveles', 'Servicio preventivo de frenos',
                   'Rotación de neumáticos + balanceo'],
        INSPECCIONAR: ['Tren delantero y reaprete', 'Suspensión delantera y trasera',
                       'Funcionamiento del sistema de embrague', 'Correas de accesorios y ajuste',
                       'Carga de batería y alternador', 'Funcionamiento de aire acondicionado',
                       'Plumillas y eyectores lanza agua', 'Funcionamiento de bocina',
                       'Ampolletas', 'Posibles fugas', 'Tren trasero',
                       'Control de códigos de fallas + escáner',
                       '[G] Filtro de polen (solo inspección)']
      },
      gratis: 'Limpieza interior y exterior del vehículo',
      activo: true },
    { id: 'c2', nombre: 'Revisión Pre-Viaje', titulo: 'REVISIÓN', subtitulo: 'PRE-VIAJE',
      bajada: 'Antes de salir a carretera, revisa lo esencial',
      descuento: 20, precio_oferta: 79900,
      tarifa: { usar: false, repuesto: 'alt' },
      urgencia: 'CUPOS LIMITADOS', cta: 'RESERVA TU CUPO',
      vigencia: '2026-09-30',
      servicios: {
        CAMBIAR: ['Plumillas limpiaparabrisas'],
        REALIZAR: ['Alineación y balanceo', 'Relleno de niveles', 'Presión de neumáticos'],
        INSPECCIONAR: ['Sistema de frenos', 'Carga de batería y alternador',
                       'Ampolletas y luces', 'Suspensión', 'Sistema de refrigeración',
                       'Neumáticos y rueda de repuesto', 'Correas de accesorios',
                       'Posibles fugas']
      },
      gratis: 'Lavado exterior',
      activo: true },
    { id: 'c3', nombre: 'Pack mantención Pro', titulo: 'PACK MANTENCIÓN', subtitulo: 'PRO',
      bajada: 'Mantención preventiva + inspección integral',
      descuento: 15, precio_oferta: 326500,
      // El precio del tarifario (planilla "Precios genéricos") ES la Oferta,
      // ya con el 15% aplicado. El "Antes" se calcula al revés: oferta ÷ (1 − descuento).
      // Antes y Oferta se muestran aproximados al múltiplo de 900 más cercano
      // (ej. $384.143 -> $383.900... o el valor exacto si ya termina en 900).
      redondear900: true,
      tarifa: { usar: true, repuesto: 'alt' }, tarifaTabla: 'generico',
      urgencia: 'SOLO POR ESTE MES', cta: 'AGENDA TU HORA',
      vigencia: '2026-09-30',
      servicios: {
        CAMBIAR: ['Filtro de aceite', 'Aceite motor', 'Golilla tapón de cárter',
                  'Filtro de aire', '[D] Filtro de polen', '[D] Filtro de combustible'],
        REALIZAR: ['Revisión y relleno de niveles', 'Servicio preventivo de frenos',
                   'Rotación de neumáticos + balanceo'],
        INSPECCIONAR: ['Tren delantero y reaprete', 'Suspensión delantera y trasera',
                       'Funcionamiento del sistema de embrague', 'Correas de accesorios y ajuste',
                       'Carga de batería y alternador', 'Funcionamiento de aire acondicionado',
                       'Plumillas y eyectores lanza agua', 'Funcionamiento de bocina',
                       'Ampolletas', 'Posibles fugas', 'Tren trasero',
                       'Control de códigos de fallas + escáner',
                       '[G] Filtro de polen (solo inspección)']
      },
      gratis: 'Limpieza interior y exterior del vehículo',
      activo: true }
  ],
  empresa: {
    logoBlanco: 'logo_didial_blanco',   // para fondos oscuros
    logoColor: 'logo_didial_color',     // para fondos claros
    fono: '+569 3740 1051',
    direccion: 'Avda. Cuatro Esquinas 759, La Serena'
  },
  piezas: []
};

/* ------------------------------------------------------------- UTILIDADES */
const $ = s => document.querySelector(s);
const $$ = s => Array.from(document.querySelectorAll(s));
const uid = () => 'x' + Math.random().toString(36).slice(2, 9);

function clp(n) {
  return '$' + Math.round(n).toLocaleString('es-CL').replace(/,/g, '.');
}
function fechaLarga(iso) {
  if (!iso) return '';
  const meses = ['ENERO','FEBRERO','MARZO','ABRIL','MAYO','JUNIO','JULIO',
                 'AGOSTO','SEPTIEMBRE','OCTUBRE','NOVIEMBRE','DICIEMBRE'];
  const [y, m, d] = iso.split('-').map(Number);
  return `VÁLIDO HASTA EL ${d} DE ${meses[m - 1]} DE ${y}`;
}
function precioAntes(oferta, descPct) {
  const d = Math.min(Math.max(descPct / 100, 0), 0.9);
  return Math.round(oferta / (1 - d));
}
/* Aproxima al múltiplo de 900 más cercano (precio "psicológico" tipo $XX.900) */
function redondear900(n) {
  return Math.round((n - 900) / 1000) * 1000 + 900;
}
function marcaDe(vehiculo) {
  const mo = DB.modelos.find(m => m.id === vehiculo.modelo_id);
  return DB.marcas.find(m => m.id === mo.marca_id);
}
function modeloDe(vehiculo) { return DB.modelos.find(m => m.id === vehiculo.modelo_id); }
function etiquetaVehiculo(v) {
  const mo = modeloDe(v);
  // piezas genéricas: sólo el tipo de vehículo, sin cilindrada ni tracción
  if (mo.generico) return mo.nombre.toUpperCase();
  const partes = [mo.nombre.toUpperCase(), v.cilindrada];
  if (v.traccion) partes.push(v.traccion.toUpperCase());
  return partes.join(' ');
}
function esDiesel(v) { return /diésel|diesel/i.test(v.combustible || ''); }
function tarifaDe(v, repuesto, tabla) {
  const cat = (modeloDe(v) || {}).categoria;
  const t = (tabla || TARIFAS_360)[cat];
  if (!t) return null;
  const clave = esDiesel(v) ? 'Diésel' : 'Gasolina';
  const fila = t[clave] || t['Gasolina'];
  if (!fila) return null;
  return { valor: fila[repuesto || 'alt'], exacta: !!t[clave], categoria: cat, combustible: clave };
}

/* -------------------------------------------------- CACHÉ DE IMÁGENES */
const imgCache = {};
function loadImg(key) {
  if (imgCache[key]) return Promise.resolve(imgCache[key]);
  return new Promise((res, rej) => {
    const im = new Image();
    im.onload = () => { imgCache[key] = im; res(im); };
    im.onerror = () => rej(new Error('No se pudo cargar el recurso: ' + key));
    im.src = ASSETS[key];
  });
}

/* Detección de hacia dónde apunta el vehículo.
   La cabina va siempre detrás del frontal, así que el centroide del techo cae
   al lado opuesto de la trompa: si el techo está a la derecha del centro de
   masa, el vehículo mira a la izquierda. Devuelve también la confianza para
   poder avisar cuando el caso es dudoso. */
function detectarOrientacion(imgOCanvas) {
  const c = document.createElement('canvas');
  const w = c.width = Math.min(imgOCanvas.width || 400, 400);
  const h = c.height = Math.round((imgOCanvas.height / imgOCanvas.width) * w);
  const x = c.getContext('2d');
  x.drawImage(imgOCanvas, 0, 0, w, h);
  const p = x.getImageData(0, 0, w, h).data;

  const tops = new Array(w).fill(h);
  const masa = new Array(w).fill(0);
  for (let cx = 0; cx < w; cx++) {
    for (let cy = 0; cy < h; cy++) {
      if (p[(cy * w + cx) * 4 + 3] > 80) {
        if (tops[cx] === h) tops[cx] = cy;
        masa[cx]++;
      }
    }
  }
  const minTop = Math.min(...tops);
  const umbral = minTop + h * 0.12;
  let sTecho = 0, nTecho = 0, sMasa = 0, tMasa = 0;
  for (let cx = 0; cx < w; cx++) {
    if (tops[cx] <= umbral) { sTecho += cx; nTecho++; }
    sMasa += masa[cx] * cx; tMasa += masa[cx];
  }
  if (!nTecho || !tMasa) return { orientacion: 'izquierda', confianza: 0 };
  const delta = (sTecho / nTecho) / w - (sMasa / tMasa) / w;
  return {
    orientacion: delta >= 0 ? 'izquierda' : 'derecha',
    confianza: Math.min(Math.abs(delta) / 0.05, 1)
  };
}

function orientacionDe(dataUrl) {
  return new Promise(res => {
    const im = new Image();
    im.onload = () => res(detectarOrientacion(im));
    im.onerror = () => res({ orientacion: 'izquierda', confianza: 0 });
    im.src = dataUrl;
  });
}

/* Normalización de recursos: recorte al bounding box del canal alfa */
function normalizarImagen(dataUrl, opts = {}) {
  const { keyWhite = true, maxW = 900, maxH = 600, umbral = 238 } = opts;
  return new Promise(res => {
    const im = new Image();
    im.onload = () => {
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      const x = c.getContext('2d');
      x.drawImage(im, 0, 0);
      const d = x.getImageData(0, 0, c.width, c.height);
      const p = d.data;
      if (keyWhite) {
        for (let i = 0; i < p.length; i += 4) {
          if (p[i] > umbral && p[i + 1] > umbral && p[i + 2] > umbral) p[i + 3] = 0;
        }
      }
      let x0 = c.width, y0 = c.height, x1 = -1, y1 = -1;
      for (let yy = 0; yy < c.height; yy++) {
        for (let xx = 0; xx < c.width; xx++) {
          if (p[(yy * c.width + xx) * 4 + 3] > 12) {
            if (xx < x0) x0 = xx; if (xx > x1) x1 = xx;
            if (yy < y0) y0 = yy; if (yy > y1) y1 = yy;
          }
        }
      }
      if (x1 < 0) { res(dataUrl); return; }
      x.putImageData(d, 0, 0);
      const cw = x1 - x0 + 1, ch = y1 - y0 + 1;
      const r = Math.min(maxW / cw, maxH / ch, 1);
      const o = document.createElement('canvas');
      o.width = Math.round(cw * r); o.height = Math.round(ch * r);
      o.getContext('2d').drawImage(c, x0, y0, cw, ch, 0, 0, o.width, o.height);
      res(o.toDataURL('image/webp', 0.85));
    };
    im.src = dataUrl;
  });
}

/* ============================================================================
   MOTOR GRÁFICO
   ========================================================================== */

function fuente(px, peso = 800) {
  return `${peso} ${px}px Nunito, "Segoe UI", system-ui, sans-serif`;
}

/* Tipografía de titular para el descuento: condensada y con más carácter que
   la Nunito del resto. Anton viene de Google Fonts, así que puede no estar
   disponible sin conexión: en ese caso se usa Nunito 900 en cursiva, que
   también se distingue del resto de la pieza. */
let ANTON_DISPONIBLE = false;

function verificarAnton() {
  try {
    const c = document.createElement('canvas').getContext('2d');
    const t = 'DESCUENTO 30%';
    c.font = '400 48px serif';
    const base = c.measureText(t).width;
    c.font = '400 48px Anton, serif';
    ANTON_DISPONIBLE = Math.abs(c.measureText(t).width - base) > 1;
  } catch (e) { ANTON_DISPONIBLE = false; }
  return ANTON_DISPONIBLE;
}

function fuenteDisplay(px) {
  return ANTON_DISPONIBLE
    ? `400 ${px}px Anton, sans-serif`
    : `italic 900 ${px}px Nunito, "Segoe UI", sans-serif`;
}

/* Reduce el tamaño hasta que el texto quepa en maxW */
function ajustar(ctx, txt, maxW, px, peso = 800, min = 10, display = false) {
  const f = s => display ? fuenteDisplay(s) : fuente(s, peso);
  let s = px;
  while (s > min) {
    ctx.font = f(s);
    if (ctx.measureText(txt).width <= maxW) break;
    s -= 1;
  }
  ctx.font = f(s);
  return s;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ------------------------------------------------------------- FONDOS */
let noiseCanvas = null;
function getNoise() {
  if (noiseCanvas) return noiseCanvas;
  const n = document.createElement('canvas');
  n.width = n.height = 220;
  const c = n.getContext('2d');
  const d = c.createImageData(220, 220);
  for (let i = 0; i < d.data.length; i += 4) {
    const v = 110 + Math.random() * 60;
    d.data[i] = d.data[i + 1] = d.data[i + 2] = v;
    d.data[i + 3] = 255;
  }
  c.putImageData(d, 0, 0);
  noiseCanvas = n;
  return n;
}

function dibujarFondo(ctx, layout) {
  const f = layout.fondo;
  const claro = layout.tema === 'claro';

  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, f.base); g.addColorStop(1, f.base2);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);

  const lay = document.createElement('canvas');
  lay.width = W; lay.height = H;
  const l = lay.getContext('2d');
  let glowX = W * 0.74, glowY = H * 0.38, glowA = '55';

  /* ---------------- TOYOTA · velocidad ---------------- */
  if (f.tipo === 'velocidad') {
    ctx.save(); ctx.globalAlpha = 0.05; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.2;
    for (let x = -H; x < W; x += 13) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x + H, H); ctx.stroke();
    }
    ctx.restore();
    l.filter = 'blur(11px)';
    [[-40, 34, .95], [180, 14, .55], [330, 44, 1], [520, 10, .35],
     [700, 28, .72], [880, 16, .42], [1080, 38, .88], [1240, 12, .3]]
      .forEach(([y0, th, a]) => {
        l.fillStyle = `rgba(${f.trazo},${a})`;
        l.beginPath();
        l.moveTo(0, y0); l.lineTo(W, y0 - H * 0.42);
        l.lineTo(W, y0 - H * 0.42 + th); l.lineTo(0, y0 + th);
        l.closePath(); l.fill();
      });

  /* ---------------- NISSAN · acero ---------------- */
  } else if (f.tipo === 'acero') {
    // planchas de acero cepillado
    ctx.save(); ctx.globalAlpha = 0.035; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    for (let y = 0; y < H; y += 4) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
    }
    ctx.restore();
    // anillos concéntricos en plata (geometría del emblema)
    l.filter = 'blur(3px)';
    const cx = W * 0.72, cy = H * 0.36;
    [0.30, 0.44, 0.60, 0.78, 0.98].forEach((r, i) => {
      l.strokeStyle = `rgba(${f.trazo},${0.30 - i * 0.045})`;
      l.lineWidth = 3.4;
      l.beginPath(); l.arc(cx, cy, W * r, 0, Math.PI * 2); l.stroke();
    });
    // barra horizontal del emblema, en gris
    l.filter = 'blur(38px)';
    l.fillStyle = `rgba(${f.trazo},0.30)`;
    l.fillRect(0, H * 0.36 - H * 0.035, W, H * 0.07);
    // reflejo diagonal de chapa
    l.filter = 'blur(52px)';
    l.fillStyle = `rgba(${f.trazo},0.16)`;
    l.beginPath();
    l.moveTo(-100, H * 0.18); l.lineTo(W * 0.55, -80);
    l.lineTo(W * 0.78, -80); l.lineTo(W * 0.16, H * 0.34);
    l.closePath(); l.fill();
    glowX = W * 0.72; glowY = H * 0.36; glowA = '3A';

  /* ---------------- GENÉRICO · taller ---------------- */
  } else if (f.tipo === 'taller') {
    // grilla técnica, como un plano de taller
    ctx.save(); ctx.globalAlpha = 0.07; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1;
    const paso = 44;
    for (let x = 0; x <= W; x += paso) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += paso) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
    ctx.restore();
    // franjas diagonales tipo cinta de señalización, en el acento de la marca
    l.filter = 'blur(2px)';
    const anchoF = 70;
    for (let i = -3; i < 11; i++) {
      l.fillStyle = `rgba(${f.trazo},${i % 2 === 0 ? 0.12 : 0.05})`;
      l.save();
      l.beginPath();
      const x0 = i * anchoF * 1.7;
      l.moveTo(x0, -60); l.lineTo(x0 + anchoF, -60);
      l.lineTo(x0 + anchoF - H * 0.4, H + 60); l.lineTo(x0 - H * 0.4, H + 60);
      l.closePath(); l.fill();
      l.restore();
    }
    // arco técnico (como un indicador circular de diagnóstico)
    l.filter = 'blur(4px)';
    l.strokeStyle = `rgba(${f.trazo},0.20)`; l.lineWidth = 3;
    l.beginPath(); l.arc(W * 0.76, H * 0.36, W * 0.30, Math.PI * 1.1, Math.PI * 1.85); l.stroke();
    glowX = W * 0.74; glowY = H * 0.36; glowA = '42';

  /* ---------------- MAZDA · invierno ---------------- */
  } else if (f.tipo === 'invierno') {
    // veladuras curvas de luz fría sobre blanco
    l.filter = 'blur(34px)';
    [[.10, .26, 120, .95], [.32, .22, 150, .65], [.56, .28, 110, .8],
     [.78, .18, 170, .55], [.95, .24, 130, .7]]
      .forEach(([off, amp, th, inten]) => {
        l.fillStyle = `rgba(255,255,255,${inten})`;
        l.beginPath();
        for (let x = 0; x <= W; x += 10) {
          const t = x / W;
          const y = (off + amp * Math.pow(Math.sin(t * Math.PI - 0.6), 3)) * H;
          x === 0 ? l.moveTo(x, y) : l.lineTo(x, y);
        }
        for (let x = W; x >= 0; x -= 10) {
          const t = x / W;
          const y = (off + amp * Math.pow(Math.sin(t * Math.PI - 0.6), 3)) * H + th;
          l.lineTo(x, y);
        }
        l.closePath(); l.fill();
      });
    // sombra fría inferior para que el blanco no quede plano
    l.filter = 'blur(80px)';
    l.fillStyle = 'rgba(140,166,196,0.70)';
    l.fillRect(-40, H * 0.70, W + 80, H * 0.36);
    l.fillStyle = 'rgba(150,175,202,0.45)';
    l.fillRect(-40, -40, W * 0.34, H * 0.55);
    glowX = W * 0.70; glowY = H * 0.30; glowA = 'AA';
  }

  ctx.save();
  ctx.globalCompositeOperation = claro ? 'source-over' : 'lighter';
  ctx.globalAlpha = f.intensidad;
  ctx.drawImage(lay, 0, 0);
  ctx.restore();

  // resplandor radial en la zona del vehículo
  const rg = ctx.createRadialGradient(glowX, glowY, 0, glowX, glowY, W * 0.62);
  rg.addColorStop(0, f.glow + glowA);
  rg.addColorStop(1, f.glow + '00');
  ctx.save();
  ctx.globalCompositeOperation = claro ? 'source-over' : 'lighter';
  ctx.fillStyle = rg; ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // grano
  ctx.save();
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = claro ? 0.025 : 0.045;
  ctx.fillStyle = ctx.createPattern(getNoise(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();

  // viñeta: oscura en temas oscuros, fría y suave en el tema claro
  const int = layout.vineta != null ? layout.vineta : 0.6;
  const v = ctx.createRadialGradient(W / 2, H * 0.45, W * 0.28, W / 2, H * 0.5, W * 0.92);
  v.addColorStop(0, claro ? 'rgba(150,175,202,0)' : 'rgba(0,0,0,0)');
  v.addColorStop(1, claro ? `rgba(150,175,202,${int})` : `rgba(0,0,0,${int})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, W, H);
}

/* Scrim de legibilidad — el fondo nunca se compone crudo */
function aplicarScrim(ctx, layout, yServicios) {
  const s = layout.scrim;
  const c = s.color || '0,0,0';   // negro oscurece, blanco aclara

  ctx.fillStyle = `rgba(${c},${s.global})`;
  ctx.fillRect(0, 0, W, H);

  const gs = ctx.createLinearGradient(0, yServicios - 40, 0, yServicios);
  gs.addColorStop(0, `rgba(${c},0)`);
  gs.addColorStop(1, `rgba(${c},${s.servicios})`);
  ctx.fillStyle = gs; ctx.fillRect(0, yServicios - 40, W, 40);
  ctx.fillStyle = `rgba(${c},${s.servicios})`;
  ctx.fillRect(0, yServicios, W, H - yServicios);

  const gt = ctx.createLinearGradient(0, 0, 520, 0);
  gt.addColorStop(0, `rgba(${c},${s.titular})`);
  gt.addColorStop(1, `rgba(${c},0)`);
  ctx.fillStyle = gt; ctx.fillRect(0, 0, 520, yServicios - 40);
}

/* -------------------------------------- DISTRIBUCIÓN DE SERVICIOS EN COLUMNAS */
/* Convierte los grupos en líneas y las reparte en N columnas equilibradas,
   repitiendo el encabezado con "(cont.)" si un grupo se parte. */
function componerServicios(servicios, columnas, altoLinea, altoTitulo, gap, altoMax) {
  const grupos = [];
  Object.keys(servicios).forEach(g => {
    const items = (servicios[g] || []).filter(Boolean);
    if (items.length) grupos.push({ nombre: g, items });
  });
  const hGrupo = g => altoTitulo + g.items.length * altoLinea;
  const total = grupos.reduce((a, g) => a + hGrupo(g) + gap, 0) - gap;
  const minima = altoTitulo + altoLinea;

  /* Empaqueta los grupos en columnas de altura máxima Hcol.
     Un grupo sólo se parte si por sí solo no cabe en una columna. */
  function empaquetar(Hcol, permitirCorte = true) {
    if (Hcol < minima) return null;
    const cols = []; let cur = []; let h = 0;
    const cerrar = () => { cols.push(cur); cur = []; h = 0; };

    for (const g of grupos) {
      const gh = hGrupo(g);
      if (gh > Hcol && !permitirCorte) return null;
      if (h > 0 && h + gap + gh > Hcol && gh <= Hcol) cerrar();
      if (h > 0) { cur.push({ tipo: 'gap' }); h += gap; }

      let i = 0;
      while (i < g.items.length) {
        if (h > 0 && h + altoTitulo + altoLinea > Hcol) cerrar();
        if (i === 0) {                       // el encabezado se escribe una sola vez
          cur.push({ tipo: 'titulo', txt: g.nombre });
          h += altoTitulo;
        }
        while (i < g.items.length && h + altoLinea <= Hcol) {
          cur.push({ tipo: 'item', txt: g.items[i] }); h += altoLinea; i++;
        }
        if (i < g.items.length) cerrar();
        if (cols.length > columnas) return null;
      }
    }
    cerrar();
    return cols.length <= columnas ? cols : null;
  }

  /* Búsqueda binaria de la altura mínima que permite repartir en N columnas:
     con eso las columnas quedan equilibradas en vez de una larga y otra vacía. */
  function buscar(permitirCorte) {
    let lo = minima, hi = Math.max(total, minima), mejor = null, mejorH = Infinity;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      const r = empaquetar(mid, permitirCorte);
      if (r) { mejor = r; mejorH = mid; hi = mid - 1; } else { lo = mid + 1; }
    }
    return mejor ? { cols: mejor, h: mejorH } : null;
  }

  /* Dos candidatos: uno que nunca parte un grupo (más legible) y otro que
     equilibra al máximo. Se prefiere el que no deje columnas vacías, porque
     una columna en blanco a la derecha se ve como un error de maquetación. */
  const limpio = buscar(false);
  const partido = buscar(true);
  const llenas = c => c ? c.cols.filter(x => x.length).length : 0;
  const minLineas = c => c ? Math.min(...c.cols.filter(x => x.length)
    .map(x => x.filter(l => l.tipo === 'item').length), Infinity) : 0;

  let elegido = limpio;
  const limpioSirve = limpio && limpio.h <= altoMax;
  const partidoSirve = partido && partido.h <= altoMax;
  if (!limpioSirve && partidoSirve) elegido = partido;
  else if (limpioSirve && partidoSirve &&
           llenas(partido) > llenas(limpio) && minLineas(partido) >= 3) {
    // partir un grupo vale la pena sólo si así se ocupan más columnas
    // y ninguna queda con menos de 3 ítems
    elegido = partido;
  }
  else if (!limpioSirve && !partidoSirve && partido && limpio && partido.h < limpio.h) {
    elegido = partido;   // si nada cabe, al menos que desborde lo menos posible
  }
  if (!elegido) elegido = partido;
  const cols = (elegido && elegido.cols) || [[]];
  while (cols.length < columnas) cols.push([]);

  const alto = l => l.tipo === 'titulo' ? altoTitulo : l.tipo === 'gap' ? gap : altoLinea;
  const alturas = cols.map(c => c.reduce((a, l) => a + alto(l), 0));
  const usado = Math.max(...alturas, 0);
  return { cols, desborde: usado > altoMax, altoUsado: usado };
}

/* Al voltear la imagen, cualquier texto sobre el vehículo (patente, insignias)
   queda al revés. El parche corrige esa zona sin tocar el resto:
     · restaurar  → vuelve a dibujar ese recorte SIN espejar, así el texto se lee
     · difuminar  → lo desenfoca hasta volverlo ilegible
   Las coordenadas del parche son relativas a la imagen original (0–1), de modo
   que siguen valiendo aunque cambie la escala o el tamaño de la pieza. */
function aplicarParche(ctx, veh, input, caja) {
  const p = input.parche;
  const modo = input.parcheModo || 'restaurar';
  if (!p || modo === 'ninguno') return;

  const { vx, vy, vw, vh } = caja;
  const sx = p.x * veh.width, sy = p.y * veh.height;
  const sw = p.w * veh.width, sh = p.h * veh.height;
  // al espejar, la zona salta al lado opuesto del vehículo
  const dx = vx + vw * (1 - p.x - p.w), dy = vy + vh * p.y;
  const dw = vw * p.w, dh = vh * p.h;
  if (sw <= 0 || sh <= 0 || dw <= 0 || dh <= 0) return;

  ctx.save();
  ctx.beginPath(); ctx.rect(dx, dy, dw, dh); ctx.clip();
  if (modo === 'difuminar') {
    ctx.filter = `blur(${Math.max(3, dw * 0.06)}px)`;
    ctx.translate(dx + dw, dy);
    ctx.scale(-1, 1);
    // se redibuja espejado y desenfocado, con margen para que el blur no deje borde
    ctx.drawImage(veh, sx - sw * 0.2, sy - sh * 0.2, sw * 1.4, sh * 1.4,
                  -dw * 0.2, -dh * 0.2, dw * 1.4, dh * 1.4);
  } else {
    ctx.drawImage(veh, sx, sy, sw, sh, dx, dy, dw, dh);
  }
  ctx.restore();

  if (input.guiaParche) {   // sólo en pantalla, nunca en el archivo exportado
    ctx.save();
    ctx.strokeStyle = '#00E5FF'; ctx.lineWidth = 2; ctx.setLineDash([9, 6]);
    ctx.strokeRect(dx, dy, dw, dh);
    ctx.restore();
  }
}

/* ---------------------------------------------------------- COMPOSICIÓN */
async function renderPieza(canvas, input) {
  const ctx = canvas.getContext('2d');
  canvas.width = W; canvas.height = H;
  ctx.clearRect(0, 0, W, H);
  ctx.textBaseline = 'top';

  const L = LAYOUTS[input.layout] || LAYOUTS.toyota;
  const P = L.paleta;
  const M = 56;
  const yFranja = 636, hFranja = 70;
  const yServicios = yFranja + 96;

  dibujarFondo(ctx, L);
  aplicarScrim(ctx, L, yFranja);

  /* --- A. Cabecera --- */
  const logo = await loadImg(input.logoEmpresa);
  const lr = Math.min(250 / logo.width, 110 / logo.height);
  const lw = logo.width * lr, lh = logo.height * lr;
  if (P.logoPlaca) {
    // el logo Didial lleva texto blanco: sobre fondo claro necesita respaldo
    ctx.fillStyle = P.logoPlaca;
    roundRect(ctx, M - 18, 46 - 14, lw + 36, lh + 28, 14); ctx.fill();
  }
  ctx.drawImage(logo, M, 46, lw, lh);

  if (input.logoMarca) {
    try {
      const bl = await loadImg(input.logoMarca);
      const br = Math.min(120 / bl.width, 78 / bl.height);
      ctx.drawImage(bl, W - M - bl.width * br, 52, bl.width * br, bl.height * br);
    } catch (e) { /* recurso ausente: la pieza sigue siendo válida */ }
  }

  /* --- Chip de modelo --- */
  const chip = input.generico ? input.etiqueta : `${input.marca.toUpperCase()} ${input.etiqueta}`;
  ajustar(ctx, chip, 420, 21);
  const cw = ctx.measureText(chip).width;
  ctx.fillStyle = P.chipBg || L.acento;
  roundRect(ctx, W - M - cw - 34, 172, cw + 34, 44, 22); ctx.fill();
  ctx.fillStyle = P.chipTexto;
  ctx.fillText(chip, W - M - cw - 17, 184);

  /* --- B. Titular --- */
  ctx.fillStyle = P.titulo;
  ajustar(ctx, input.titulo, 620, 50, 900);
  ctx.fillText(input.titulo, M, 150);
  ctx.fillStyle = P.destacado;
  ajustar(ctx, input.subtitulo, 620, 70, 900);
  ctx.fillText(input.subtitulo, M, 202);
  ctx.fillStyle = P.bajada;
  ajustar(ctx, input.bajada.toUpperCase(), 620, 19, 700);
  ctx.fillText(input.bajada.toUpperCase(), M, 284);

  /* --- C. Vehículo --- */
  if (input.imagenVehiculo) {
    try {
      const veh = await loadImg(input.imagenVehiculo);
      const esc = input.escala || 1;
      const r = Math.min(700 / veh.width, 300 / veh.height) * esc;
      const vw = veh.width * r, vh = veh.height * r;
      const vx = W - vw - 24 + (input.offx || 0);
      const vy = 330 + (input.offy || 0);
      ctx.save();
      ctx.filter = 'blur(13px)';
      ctx.fillStyle = P.sombraVehiculo;
      ctx.beginPath();
      ctx.ellipse(vx + vw / 2, vy + vh - 6, vw * 0.36, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      // el layout exige que el vehículo mire hacia la izquierda (hacia el texto)
      const voltear = (input.orientacion || 'izquierda') !== 'izquierda';
      if (voltear) {
        ctx.save();
        ctx.translate(vx + vw, vy);
        ctx.scale(-1, 1);
        ctx.drawImage(veh, 0, 0, vw, vh);
        ctx.restore();
        aplicarParche(ctx, veh, input, { vx, vy, vw, vh });
      } else {
        ctx.drawImage(veh, vx, vy, vw, vh);
      }
    } catch (e) { /* validación ya avisó */ }
  }

  /* --- D. Franja de descuento --- */
  ctx.fillStyle = P.bandaBg;
  ctx.fillRect(0, yFranja, W, hFranja);
  ctx.fillStyle = L.acento;
  ctx.fillRect(0, yFranja, 12, hFranja);
  ctx.fillStyle = P.bandaTexto;
  const txtDesc = `${input.descuento}% DE DESCUENTO`;
  if ('letterSpacing' in ctx) ctx.letterSpacing = '1.5px';
  ajustar(ctx, txtDesc, 600, 48, 900, 20, true);
  ctx.fillText(txtDesc, M, yFranja + 10);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
  ajustar(ctx, input.urgencia, 330, 21, 800);
  ctx.fillText(input.urgencia, W - M - ctx.measureText(input.urgencia).width, yFranja + 25);

  /* --- E. Servicios --- */
  // se descartan los servicios que no aplican al combustible del vehículo
  const serviciosAplicables = {};
  Object.keys(input.servicios || {}).forEach(g => {
    const lista = (input.servicios[g] || [])
      .filter(t => t && esDe(t, input.combustible))
      .map(sinPrefijo);
    if (lista.length) serviciosAplicables[g] = lista;
  });

  const altoMax = 1070 - yServicios;
  let cfg = { linea: 25, titulo: 30, gap: 12, texto: 17 };
  let comp = componerServicios(serviciosAplicables, 3, cfg.linea, cfg.titulo, cfg.gap, altoMax);
  if (comp.desborde) {
    cfg = { linea: 22, titulo: 27, gap: 9, texto: 15 };
    comp = componerServicios(serviciosAplicables, 3, cfg.linea, cfg.titulo, cfg.gap, altoMax);
  }
  const colX = [M, M + 340, M + 680];
  const colW = 310;
  comp.cols.forEach((col, i) => {
    let y = yServicios;
    col.forEach(l => {
      if (l.tipo === 'gap') { y += cfg.gap; return; }
      if (l.tipo === 'titulo') {
        ctx.fillStyle = P.grupoTitulo;
        ajustar(ctx, l.txt, colW, 22, 900);
        ctx.fillText(l.txt, colX[i], y);
        y += cfg.titulo;
        return;
      }
      ctx.fillStyle = L.acento;
      ctx.beginPath(); ctx.arc(colX[i] + 6, y + cfg.texto * 0.62, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = P.item;
      ajustar(ctx, l.txt, colW - 19, cfg.texto, 500, 12);
      ctx.fillText(l.txt, colX[i] + 19, y);
      y += cfg.linea;
    });
  });

  /* --- F. Bloque comercial --- */
  const yp = 1078, bw = 372, bh = 140;
  ctx.fillStyle = P.precioBg;
  roundRect(ctx, W - M - bw, yp, bw, bh, 14); ctx.fill();
  if (P.precioBorde) { ctx.strokeStyle = P.precioBorde; ctx.lineWidth = 1.5; ctx.stroke(); }
  ctx.fillStyle = P.precioLabel;
  ctx.font = fuente(21, 800);
  ctx.fillText('OFERTA', W - M - bw + 22, yp + 10);
  ctx.fillStyle = P.precioTexto;
  const ofertaMostrada = input.redondear900 ? redondear900(input.precioOferta) : input.precioOferta;
  const po = clp(ofertaMostrada);
  ajustar(ctx, po, bw - 44, 50, 900);
  ctx.fillText(po, W - M - bw + 22, yp + 38);

  // "ANTES": más presente, porque es lo que da sentido al descuento
  const antesCrudo = input.precioAntesBase;
  const antes = clp(input.redondear900 ? redondear900(antesCrudo) : antesCrudo);
  const ax = W - M - bw + 22, ay = yp + 100;
  ctx.fillStyle = P.precioAntes;
  ctx.font = fuente(15, 800);
  ctx.fillText('ANTES', ax, ay + 6);
  const wLbl = ctx.measureText('ANTES').width + 8;
  const szAntes = ajustar(ctx, antes, bw - 44 - wLbl, 26, 900);
  ctx.fillText(antes, ax + wLbl, ay);
  const aw = ctx.measureText(antes).width;
  ctx.strokeStyle = P.precioAntes; ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(ax + wLbl - 1, ay + szAntes * 0.56);
  ctx.lineTo(ax + wLbl + aw + 1, ay + szAntes * 0.56);
  ctx.stroke();

  if (input.gratis) {
    ctx.fillStyle = P.gratisTitulo || L.acento;
    ajustar(ctx, 'SERVICIO ADICIONAL GRATIS', 480, 19, 900);
    ctx.fillText('SERVICIO ADICIONAL GRATIS', M, yp + 14);
    ctx.fillStyle = P.gratisTexto;
    ajustar(ctx, input.gratis, 480, 18, 500);
    ctx.fillText(input.gratis, M, yp + 42);
  }
  ctx.fillStyle = P.vigencia;
  ajustar(ctx, fechaLarga(input.vigencia), 480, 14, 600);
  ctx.fillText(fechaLarga(input.vigencia), M, yp + 86);

  /* --- G. Pie --- */
  ctx.fillStyle = L.acento; ctx.fillRect(0, 1246, W, 4);
  ctx.fillStyle = P.pieBg; ctx.fillRect(0, 1250, W, H - 1250);
  ctx.fillStyle = P.pieCta;
  ajustar(ctx, input.cta, 500, 26, 900);
  ctx.fillText(input.cta, M, 1274);
  ctx.fillStyle = P.pieTexto;
  const contacto = `WhatsApp ${input.fono}   ·   ${input.direccion}`;
  ajustar(ctx, contacto, W - M * 2, 18, 700);
  ctx.fillText(contacto, M, 1310);

  return comp;
}

/* ============================================================================
   VALIDACIÓN
   ========================================================================== */
function validar(input, comp) {
  const errores = [], avisos = [];
  if (!input.imagenVehiculo) errores.push('Este modelo todavía no tiene foto cargada.');
  if (input.tarifa && !input.tarifa.exacta)
    avisos.push(`El tarifario no tiene precio diésel para ${CATEGORIAS[input.tarifa.categoria]}: ` +
                'se está usando el de bencinero.');
  if (!input.precioOferta || input.precioOferta <= 0) errores.push('Falta el precio de oferta.');
  if (!input.titulo) errores.push('Falta el título de la campaña.');
  if (!input.etiqueta) errores.push('Falta el modelo del vehículo.');
  const nServ = Object.values(input.servicios).reduce((a, v) => a + v.filter(Boolean).length, 0);
  if (nServ === 0) errores.push('La campaña no tiene ningún servicio.');
  if (input.descuento < 0 || input.descuento > 90) errores.push('El descuento debe estar entre 0 % y 90 %.');
  if (input.vigencia && new Date(input.vigencia + 'T23:59:59') < new Date())
    avisos.push('La vigencia de la campaña ya venció.');
  if (comp && comp.desborde)
    avisos.push('Los servicios exceden la zona disponible aun con la tipografía reducida. Recorta ítems.');
  if (nServ > 26) avisos.push(`${nServ} servicios es mucho para leer en un feed. Considera 20–24.`);
  Object.values(input.servicios).flat().forEach(s => {
    if (s && s.length > 38) avisos.push(`Texto largo, se reducirá la fuente: "${s.slice(0, 34)}…"`);
  });
  if (String(input.precioOferta).length > 7) avisos.push('Precio de 8+ dígitos: la fuente se ajustará sola.');
  if ((input.orientacion || 'izquierda') !== 'izquierda' &&
      (!input.parche || input.parcheModo === 'ninguno'))
    avisos.push('La imagen se está volteando: los textos sobre el vehículo (patente, ' +
                'insignias) quedan invertidos. Usa el parche en "Ajuste fino".');
  return { errores, avisos };
}

/* ============================================================================
   EXPORTACIÓN
   ========================================================================== */
function descargar(blob, nombre) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = nombre; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function exportarPNG(canvas, nombre, escala = 1) {
  return new Promise(res => {
    if (escala === 1) {
      canvas.toBlob(b => { descargar(b, nombre + '.png'); res(); }, 'image/png');
      return;
    }
    const c = document.createElement('canvas');
    c.width = W * escala; c.height = H * escala;
    const x = c.getContext('2d');
    x.imageSmoothingQuality = 'high';
    x.drawImage(canvas, 0, 0, c.width, c.height);
    c.toBlob(b => { descargar(b, nombre + `@${escala}x.png`); res(); }, 'image/png');
  });
}

/* PDF construido a mano: una página, imagen JPEG embebida vía DCTDecode.
   Sin dependencias externas — funciona sin conexión. */
function construirPDF(jpegBytes, wPx, hPx) {
  const wPt = wPx * 72 / 96, hPt = hPx * 72 / 96;
  const enc = new TextEncoder();
  const partes = [];
  const offsets = [0];
  let len = 0;
  const push = s => {
    const b = typeof s === 'string' ? enc.encode(s) : s;
    partes.push(b); len += b.length;
  };
  const obj = (n, body, stream) => {
    offsets[n] = len;
    push(`${n} 0 obj\n${body}\n`);
    if (stream) { push('stream\n'); push(stream); push('\nendstream\n'); }
    push('endobj\n');
  };

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  obj(1, '<< /Type /Catalog /Pages 2 0 R >>');
  obj(2, '<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
  obj(3, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${wPt.toFixed(2)} ${hPt.toFixed(2)}] ` +
         `/Resources << /XObject << /Im0 5 0 R >> >> /Contents 4 0 R >>`);
  const contenido = `q ${wPt.toFixed(2)} 0 0 ${hPt.toFixed(2)} 0 0 cm /Im0 Do Q`;
  obj(4, `<< /Length ${contenido.length} >>`, contenido);
  obj(5, `<< /Type /XObject /Subtype /Image /Width ${wPx} /Height ${hPx} ` +
         `/ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode ` +
         `/Length ${jpegBytes.length} >>`, jpegBytes);

  const xrefPos = len;
  let xref = `xref\n0 6\n0000000000 65535 f \n`;
  for (let i = 1; i <= 5; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  push(xref);
  push(`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF`);

  const out = new Uint8Array(len);
  let p = 0;
  partes.forEach(b => { out.set(b, p); p += b.length; });
  return new Blob([out], { type: 'application/pdf' });
}

function exportarPDF(canvas, nombre) {
  return new Promise(res => {
    // fondo blanco bajo la imagen para el JPEG (sin alfa)
    const c = document.createElement('canvas');
    c.width = canvas.width; c.height = canvas.height;
    const x = c.getContext('2d');
    x.fillStyle = '#000'; x.fillRect(0, 0, c.width, c.height);
    x.drawImage(canvas, 0, 0);
    c.toBlob(async b => {
      const buf = new Uint8Array(await b.arrayBuffer());
      descargar(construirPDF(buf, c.width, c.height), nombre + '.pdf');
      res();
    }, 'image/jpeg', 0.95);
  });
}

/* ============================================================================
   INTERFAZ
   ========================================================================== */
const estado = { vehiculoId: null, campanaId: 'c1', override: {}, ultimaComp: null };

/* Arranca en el primer vehículo cuyo modelo tenga foto cargada */
function vehiculoInicial() {
  const conFoto = DB.modelos.filter(m => m.imagen).map(m => m.id);
  const v = DB.vehiculos.find(x => conFoto.includes(x.modelo_id)) || DB.vehiculos[0];
  return v.id;
}

function inputActual() {
  const v = DB.vehiculos.find(x => x.id === estado.vehiculoId) || DB.vehiculos[0];
  const c = DB.campanas.find(x => x.id === estado.campanaId) || DB.campanas[0];
  const marca = marcaDe(v);
  const mo = modeloDe(v);
  const o = estado.override;
  const L = LAYOUTS[marca.layout] || LAYOUTS.toyota;
  const tablaTarifa = c.tarifaTabla === 'generico' ? TARIFAS_GENERICO : TARIFAS_360;
  const t = (c.tarifa && c.tarifa.usar) ? tarifaDe(v, c.tarifa.repuesto, tablaTarifa) : null;
  const descuento = Number(o.descuento ?? c.descuento);
  const base = Number(o.precioOferta ?? (t && t.valor) ?? c.precio_oferta);
  // Por defecto el valor base ES la Oferta y el Antes se infla (comportamiento histórico).
  // Cuando descuentoSobre === 'antes', el valor base es el precio "Antes" (p.ej. el
  // tarifario) y el 15%/30%/etc. se descuenta desde ahí para obtener la Oferta.
  const descuentoSobreAntes = c.descuentoSobre === 'antes';
  return {
    layout: marca.layout,
    marca: marca.nombre,
    logoMarca: marca.logo,
    // el logo se elige por contraste con el fondo, no a mano
    logoEmpresa: L.logoVariante === 'color' ? DB.empresa.logoColor : DB.empresa.logoBlanco,
    etiqueta: etiquetaVehiculo(v),
    generico: !!mo.generico,
    imagenVehiculo: mo.imagen,
    orientacion: mo.orientacion || 'izquierda',
    parche: mo.parche, parcheModo: mo.parcheModo || 'restaurar',
    guiaParche: !!estado.guiaParche,
    escala: mo.escala, offx: mo.offx, offy: mo.offy,
    combustible: v.combustible, transmision: v.transmision,
    categoria: mo.categoria,
    titulo: o.titulo ?? c.titulo,
    subtitulo: o.subtitulo ?? c.subtitulo,
    bajada: o.bajada ?? c.bajada,
    descuento,
    precioOferta: descuentoSobreAntes ? Math.round(base * (1 - descuento / 100)) : base,
    precioAntesBase: descuentoSobreAntes ? base : precioAntes(base, descuento),
    descuentoSobreAntes,
    tarifa: t,
    urgencia: o.urgencia ?? c.urgencia,
    cta: o.cta ?? c.cta,
    vigencia: o.vigencia ?? c.vigencia,
    gratis: o.gratis ?? c.gratis,
    servicios: o.servicios ?? c.servicios,
    redondear900: !!c.redondear900,
    fono: DB.empresa.fono,
    direccion: DB.empresa.direccion,
    vehiculoId: v.id, campanaId: c.id
  };
}

/* Render inmediato (sin debounce y sin la guía en pantalla) para exportar */
async function renderAhora() {
  clearTimeout(pendiente);
  const previa = estado.guiaParche;
  estado.guiaParche = false;
  const inp = inputActual();
  estado.ultimaComp = await renderPieza($('#lienzo'), inp);
  estado.guiaParche = previa;
  return inp;
}

let pendiente = null;
function repintar() {
  clearTimeout(pendiente);
  pendiente = setTimeout(async () => {
    const inp = inputActual();
    const comp = await renderPieza($('#lienzo'), inp);
    estado.ultimaComp = comp;
    const { errores, avisos } = validar(inp, comp);
    const box = $('#validacion');
    box.innerHTML =
      errores.map(e => `<div class="v err">✕ ${e}</div>`).join('') +
      avisos.map(a => `<div class="v warn">! ${a}</div>`).join('') ||
      '<div class="v ok">✓ Pieza válida, lista para generar</div>';
    $('#btnPng').disabled = $('#btnPdf').disabled = $('#btnPng3').disabled = errores.length > 0;
    const antesPrevia = inp.precioAntesBase;
    $('#antesLbl').textContent = clp(inp.redondear900 ? redondear900(antesPrevia) : antesPrevia)
      + (inp.redondear900 ? ' (aprox. ...900)' : '');
  }, 180);
}

/* ---- Panel del generador ---- */
function pintarGenerador() {
  const v = DB.vehiculos.find(x => x.id === estado.vehiculoId) || DB.vehiculos[0];
  const mo = modeloDe(v);
  const marcaSel = mo.marca_id;
  const c = DB.campanas.find(x => x.id === estado.campanaId) || DB.campanas[0];
  const o = estado.override;
  const serv = o.servicios ?? c.servicios;

  const modelos = DB.modelos.filter(m => m.marca_id === marcaSel && m.activo);
  const hermanos = DB.vehiculos.filter(x => x.modelo_id === v.modelo_id && x.activo);
  const cilindradas = [...new Set(hermanos.map(x => x.cilindrada))];
  const mismasCil = hermanos.filter(x => x.cilindrada === v.cilindrada);
  const tablaTarifa = c.tarifaTabla === 'generico' ? TARIFAS_GENERICO : TARIFAS_360;
  const t = (c.tarifa && c.tarifa.usar) ? tarifaDe(v, c.tarifa.repuesto, tablaTarifa) : null;

  const variante = x => [x.combustible, x.transmision, x.traccion].filter(Boolean).join(' · ');

  $('#panelGen').innerHTML = `
    <h3>1 · Vehículo <span class="hint">${DB.vehiculos.length} versiones</span></h3>
    <div class="grid2">
      <label>Marca
        <select id="selMarca">${DB.marcas.filter(m => m.activo).map(m =>
          `<option value="${m.id}" ${m.id === marcaSel ? 'selected' : ''}>${m.nombre}</option>`).join('')}</select>
      </label>
      <label>Modelo
        <select id="selModelo">${modelos.map(m =>
          `<option value="${m.id}" ${m.id === v.modelo_id ? 'selected' : ''}>${m.nombre}${m.imagen ? '' : '  ·  sin foto'}</option>`).join('')}</select>
      </label>
    </div>
    <div class="grid2">
      <label>Cilindrada
        <select id="selCil">${cilindradas.map(cc =>
          `<option value="${cc}" ${cc === v.cilindrada ? 'selected' : ''}>${cc ? cc + ' L' : 'Genérico'}</option>`).join('')}</select>
      </label>
      <label>Motor / Transmisión
        <select id="selVeh">${mismasCil.map(x =>
          `<option value="${x.id}" ${x.id === v.id ? 'selected' : ''}>${variante(x)}</option>`).join('')}</select>
      </label>
    </div>
    <div class="ficha">
      <span><b>Cilindrada</b>${v.cilindrada ? v.cilindrada + ' L' : '—'}</span>
      <span><b>Combustible</b>${v.combustible}</span>
      <span><b>Transmisión</b>${v.transmision || '—'}</span>
      <span><b>Tracción</b>${v.traccion || '—'}</span>
    </div>
    ${mo.imagen ? '' : '<div class="v err">✕ Este modelo aún no tiene foto. Cárgala en Recursos.</div>'}

    <details${estado.abrirAjuste ? ' open' : ''}><summary>Ajuste fino de la imagen (aplica a todo el modelo)</summary>
      <label>El vehículo mira hacia
        <select id="selOrient">
          <option value="izquierda" ${(mo.orientacion || 'izquierda') === 'izquierda' ? 'selected' : ''}>← Izquierda (original)</option>
          <option value="derecha" ${mo.orientacion === 'derecha' ? 'selected' : ''}>Derecha → (se voltea)</option>
        </select>
      </label>
      ${mo.orientacion === 'derecha' ? `
      <label>Textos invertidos (patente, insignias)
        <select id="selParche">
          <option value="restaurar" ${(mo.parcheModo || 'restaurar') === 'restaurar' ? 'selected' : ''}>Restaurar el texto (recomendado)</option>
          <option value="difuminar" ${mo.parcheModo === 'difuminar' ? 'selected' : ''}>Difuminar la zona</option>
          <option value="ninguno" ${mo.parcheModo === 'ninguno' ? 'selected' : ''}>Dejar como está</option>
        </select>
      </label>
      ${mo.parcheModo !== 'ninguno' ? `
      <label class="check"><input type="checkbox" id="chkGuia" ${estado.guiaParche ? 'checked' : ''}> Ver el recuadro del parche</label>
      <label class="rango">Posición X <input type="range" id="pX" min="0" max="0.95" step="0.005" value="${(mo.parche || {}).x ?? 0.77}"></label>
      <label class="rango">Posición Y <input type="range" id="pY" min="0" max="0.95" step="0.005" value="${(mo.parche || {}).y ?? 0.52}"></label>
      <label class="rango">Ancho <input type="range" id="pW" min="0.03" max="0.5" step="0.005" value="${(mo.parche || {}).w ?? 0.15}"></label>
      <label class="rango">Alto <input type="range" id="pH" min="0.03" max="0.5" step="0.005" value="${(mo.parche || {}).h ?? 0.10}"></label>
      ` : ''}` : ''}
      <label class="rango">Escala <input type="range" id="rEsc" min="0.6" max="1.4" step="0.02" value="${mo.escala}"></label>
      <label class="rango">Horizontal <input type="range" id="rX" min="-160" max="60" step="2" value="${mo.offx}"></label>
      <label class="rango">Vertical <input type="range" id="rY" min="-80" max="120" step="2" value="${mo.offy}"></label>
    </details>

    <h3>2 · Campaña</h3>
    <label>Campaña
      <select id="selCamp">${DB.campanas.filter(x => x.activo).map(x =>
        `<option value="${x.id}" ${x.id === c.id ? 'selected' : ''}>${x.nombre}</option>`).join('')}</select>
    </label>
    <div class="grid2">
      <label>Título <input id="fTitulo" value="${esc(o.titulo ?? c.titulo)}"></label>
      <label>Destacado <input id="fSub" value="${esc(o.subtitulo ?? c.subtitulo)}"></label>
    </div>
    <label>Bajada <input id="fBajada" value="${esc(o.bajada ?? c.bajada)}"></label>

    <label class="check"><input type="checkbox" id="chkTarifa" ${c.tarifa && c.tarifa.usar ? 'checked' : ''}> Tomar el precio del tarifario</label>
    ${c.tarifa && c.tarifa.usar ? `
      <label>Repuesto
        <select id="selRep">
          <option value="alt" ${c.tarifa.repuesto === 'alt' ? 'selected' : ''}>Alternativo</option>
          <option value="orig" ${c.tarifa.repuesto === 'orig' ? 'selected' : ''}>Original</option>
        </select>
      </label>
      <p class="hint">${t
        ? `${CATEGORIAS[t.categoria]} · ${t.combustible} · ${c.tarifa.repuesto === 'alt' ? 'alternativo' : 'original'} → <b>${clp(t.valor)}</b>${t.exacta ? '' : ' <span style="color:var(--warn)">(sin tarifa diésel para esta categoría: se usa la de bencinero)</span>'}`
        : '<span style="color:var(--warn)">No hay tarifa para esta categoría.</span>'}</p>` : ''}
    <div class="grid3">
      <label>Descuento % <input type="number" id="fDesc" min="0" max="90" value="${o.descuento ?? c.descuento}"></label>
      <label>${c.descuentoSobre === 'antes' ? 'Precio antes (tarifario)' : 'Precio oferta'} <input type="number" id="fPrecio" step="1000" value="${o.precioOferta ?? (t && t.valor) ?? c.precio_oferta}"></label>
      <label>Antes <div class="calc" id="antesLbl">—</div></label>
    </div>
    <div class="grid2">
      <label>Urgencia <input id="fUrg" value="${esc(o.urgencia ?? c.urgencia)}"></label>
      <label>Llamado a la acción <input id="fCta" value="${esc(o.cta ?? c.cta)}"></label>
    </div>
    <label>Vigencia <input type="date" id="fVig" value="${o.vigencia ?? c.vigencia}"></label>

    <h3>3 · Servicios <span class="hint">un ítem por línea</span></h3>
    <p class="hint">Prefija <b>[D]</b> para que un ítem salga sólo en diésel y <b>[G]</b> sólo en
    bencinero. Sin prefijo aparece siempre. Este vehículo es <b>${v.combustible}</b>.</p>
    ${['CAMBIAR', 'REALIZAR', 'INSPECCIONAR'].map(g => {
      const items = serv[g] || [];
      const visibles = items.filter(x => esDe(x, v.combustible)).length;
      return `
      <label>${g} <span class="hint">${visibles} de ${items.length} en esta pieza</span>
        <textarea data-grupo="${g}" rows="${Math.min(items.length + 1, 9)}">${esc(items.join('\n'))}</textarea>
      </label>`;
    }).join('')}
    <label>Servicio adicional gratis <input id="fGratis" value="${esc(o.gratis ?? c.gratis)}"></label>
    <button class="ghost" id="btnReset">Restablecer valores de la campaña</button>
  `;

  $('#selMarca').onchange = e => {
    const marcaSel = DB.marcas.find(x => x.id === e.target.value);
    const m = DB.modelos.find(x => x.marca_id === e.target.value && x.activo);
    estado.vehiculoId = DB.vehiculos.find(x => x.modelo_id === m.id && x.activo).id;
    // al pasar a la marca Genérico, la campaña salta directo a "Pack mantención Pro";
    // al pasar a una marca real (Toyota/Mazda/Nissan), vuelve a "Pack Mantención 360°"
    if (marcaSel && marcaSel.slug === 'generico') {
      estado.campanaId = 'c3';
      estado.override = {};
    } else if (marcaSel) {
      estado.campanaId = 'c1';
      estado.override = {};
    }
    pintarGenerador(); repintar();
  };
  $('#selModelo').onchange = e => {
    estado.vehiculoId = DB.vehiculos.find(x => x.modelo_id === e.target.value && x.activo).id;
    pintarGenerador(); repintar();
  };
  $('#selCil').onchange = e => {
    estado.vehiculoId = hermanos.find(x => x.cilindrada === e.target.value).id;
    pintarGenerador(); repintar();
  };
  $('#selVeh').onchange = e => { estado.vehiculoId = e.target.value; pintarGenerador(); repintar(); };
  $('#selCamp').onchange = e => { estado.campanaId = e.target.value; estado.override = {}; pintarGenerador(); repintar(); };
  $('#btnReset').onclick = () => { estado.override = {}; pintarGenerador(); repintar(); };

  $('#chkTarifa').onchange = e => {
    c.tarifa = c.tarifa || { usar: false, repuesto: 'alt' };
    c.tarifa.usar = e.target.checked;
    delete estado.override.precioOferta;
    pintarGenerador(); repintar();
  };
  const sr = $('#selRep');
  if (sr) sr.onchange = () => {
    c.tarifa.repuesto = sr.value;
    delete estado.override.precioOferta;
    pintarGenerador(); repintar();
  };

  const bind = (sel, campo, num) => {
    const el = $(sel); if (!el) return;
    el.oninput = () => { estado.override[campo] = num ? Number(el.value) : el.value; repintar(); };
  };
  bind('#fTitulo', 'titulo'); bind('#fSub', 'subtitulo'); bind('#fBajada', 'bajada');
  bind('#fDesc', 'descuento', true); bind('#fPrecio', 'precioOferta', true);
  bind('#fUrg', 'urgencia'); bind('#fCta', 'cta'); bind('#fVig', 'vigencia');
  bind('#fGratis', 'gratis');

  $$('#panelGen textarea[data-grupo]').forEach(t2 => {
    t2.oninput = () => {
      const base = estado.override.servicios ?? JSON.parse(JSON.stringify(serv));
      base[t2.dataset.grupo] = t2.value.split('\n').map(x => x.trim()).filter(Boolean);
      estado.override.servicios = base;
      repintar();
    };
  });

  const so = $('#selOrient');
  if (so) so.onchange = () => {
    mo.orientacion = so.value;
    if (so.value === 'derecha' && !mo.parche) mo.parche = { x: 0.77, y: 0.52, w: 0.15, h: 0.10 };
    estado.abrirAjuste = true; pintarGenerador(); repintar();
  };
  const sp = $('#selParche');
  if (sp) sp.onchange = () => {
    mo.parcheModo = sp.value;
    if (!mo.parche) mo.parche = { x: 0.77, y: 0.52, w: 0.15, h: 0.10 };
    estado.abrirAjuste = true; pintarGenerador(); repintar();
  };
  const cg = $('#chkGuia');
  if (cg) cg.onchange = () => { estado.guiaParche = cg.checked; repintar(); };
  [['#pX', 'x'], ['#pY', 'y'], ['#pW', 'w'], ['#pH', 'h']].forEach(([sel, campo]) => {
    const el = $(sel); if (!el) return;
    el.oninput = () => {
      if (!mo.parche) mo.parche = { x: 0.77, y: 0.52, w: 0.15, h: 0.10 };
      mo.parche[campo] = Number(el.value); repintar();
    };
  });
  ['#rEsc', '#rX', '#rY'].forEach((sel, i) => {
    const el = $(sel); if (!el) return;
    el.oninput = () => { mo[['escala', 'offx', 'offy'][i]] = Number(el.value); repintar(); };
  });
}

function esc(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* ---- Pestañas de administración ---- */
function pintarVehiculos() {
  const q = (estado.filtroVeh || '').toLowerCase();
  const modelos = DB.modelos.filter(m =>
    !q || m.nombre.toLowerCase().includes(q) ||
    (DB.marcas.find(x => x.id === m.marca_id) || {}).nombre.toLowerCase().includes(q));

  $('#panelVeh').innerHTML = `
    <h3>Catálogo <span class="hint">${DB.modelos.length} modelos · ${DB.vehiculos.length} versiones</span></h3>
    <label>Buscar <input id="fBuscar" value="${esc(estado.filtroVeh || '')}" placeholder="Hilux, CX-5, Nissan…"></label>
    <table><thead><tr><th>Marca</th><th>Modelo</th><th>Categoría</th><th>Versiones</th><th>Foto</th></tr></thead><tbody>
      ${modelos.map(m => {
        const n = DB.vehiculos.filter(v => v.modelo_id === m.id).length;
        return `<tr>
          <td>${(DB.marcas.find(x => x.id === m.marca_id) || {}).nombre}</td>
          <td>${m.nombre}</td>
          <td><select class="mini-sel" data-cat="${m.id}">${Object.keys(CATEGORIAS).map(k =>
            `<option value="${k}" ${k === m.categoria ? 'selected' : ''}>${CATEGORIAS[k]}</option>`).join('')}</select></td>
          <td>${n}</td>
          <td>${m.imagen ? '✓' : '<span style="color:var(--warn)">falta</span>'}</td></tr>`;
      }).join('')}
    </tbody></table>
    <p class="hint">La categoría define qué tarifa se aplica. La asigné automáticamente por
    tipo de vehículo; revísala, sobre todo en los modelos que no son pickup.</p>

    <h3>Agregar versión a un modelo</h3>
    <div class="grid2">
      <label>Modelo <select id="nvModelo">${DB.modelos.map(m =>
        `<option value="${m.id}">${(DB.marcas.find(x => x.id === m.marca_id) || {}).nombre} ${m.nombre}</option>`).join('')}</select></label>
      <label>Cilindrada <input id="nvCil" placeholder="2.8"></label>
    </div>
    <div class="grid3">
      <label>Combustible <select id="nvComb"><option>Diésel</option><option>Gasolina</option></select></label>
      <label>Transmisión <input id="nvTrans" placeholder="AT 6vel"></label>
      <label>Tracción <select id="nvTrac"><option value="">—</option><option>4x2</option><option>4x4</option></select></label>
    </div>
    <button id="btnAddVeh">Agregar versión</button>

    <h3>Agregar modelo</h3>
    <div class="grid3">
      <label>Marca <select id="nmMarca">${DB.marcas.map(m => `<option value="${m.id}">${m.nombre}</option>`).join('')}</select></label>
      <label>Nombre <input id="nmNombre" placeholder="RAV4"></label>
      <label>Categoría <select id="nmCat">${Object.keys(CATEGORIAS).map(k =>
        `<option value="${k}">${CATEGORIAS[k]}</option>`).join('')}</select></label>
    </div>
    <button id="btnAddModelo">Agregar modelo</button>

    <h3>Tarifario · Pack Mantención 360° <span class="hint">Toyota / Mazda / Nissan</span></h3>
    <table><thead><tr><th>Categoría</th><th>Diésel alt.</th><th>Diésel orig.</th>
      <th>Bencina alt.</th><th>Bencina orig.</th></tr></thead><tbody>
      ${Object.keys(CATEGORIAS).map(k => {
        const t = TARIFAS_360[k] || {};
        const cel = (f, r) => (t[f] && t[f][r] != null) ? clp(t[f][r]) : '<span class="hint">—</span>';
        return `<tr><td>${CATEGORIAS[k]}</td><td>${cel('Diésel','alt')}</td><td>${cel('Diésel','orig')}</td>
                <td>${cel('Gasolina','alt')}</td><td>${cel('Gasolina','orig')}</td></tr>`;
      }).join('')}
    </tbody></table>
    <p class="hint">Tomado de <b>Pack mantención 360.xlsx</b>. El diésel incluye cambio de filtro de
    combustible; en bencinero ese filtro no se cambia y el de polen sólo se inspecciona.</p>

    <h3>Tarifario · Pack mantención Pro <span class="hint">piezas genéricas</span></h3>
    <table><thead><tr><th>Categoría</th><th>Diésel alt.</th><th>Diésel orig.</th>
      <th>Bencina alt.</th><th>Bencina orig.</th></tr></thead><tbody>
      ${Object.keys(CATEGORIAS).map(k => {
        const t = TARIFAS_GENERICO[k] || {};
        const cel = (f, r) => (t[f] && t[f][r] != null) ? clp(t[f][r]) : '<span class="hint">—</span>';
        return `<tr><td>${CATEGORIAS[k]}</td><td>${cel('Diésel','alt')}</td><td>${cel('Diésel','orig')}</td>
                <td>${cel('Gasolina','alt')}</td><td>${cel('Gasolina','orig')}</td></tr>`;
      }).join('')}
    </tbody></table>
    <p class="hint">Tomado de <b>Precios genericos.xlsx</b>.</p>
  `;

  const fb = $('#fBuscar');
  fb.oninput = () => {
    estado.filtroVeh = fb.value;
    pintarVehiculos();
    const el = $('#fBuscar'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  };
  $$('[data-cat]').forEach(sel => sel.onchange = () => {
    DB.modelos.find(m => m.id === sel.dataset.cat).categoria = sel.value;
    pintarGenerador(); repintar();
  });
  $('#btnAddModelo').onclick = () => {
    const nombre = $('#nmNombre').value.trim(); if (!nombre) return;
    DB.modelos.push({ id: uid(), marca_id: $('#nmMarca').value, nombre,
      categoria: $('#nmCat').value, imagen: null, orientacion: 'izquierda',
      parcheModo: 'restaurar', parche: null, escala: 1, offx: 0, offy: 0, activo: true });
    pintarVehiculos(); pintarGenerador();
  };
  $('#btnAddVeh').onclick = () => {
    const cil = $('#nvCil').value.trim(); if (!cil) return;
    DB.vehiculos.push({ id: uid(), modelo_id: $('#nvModelo').value, cilindrada: cil,
      combustible: $('#nvComb').value, transmision: $('#nvTrans').value.trim(),
      traccion: $('#nvTrac').value, activo: true });
    pintarVehiculos(); pintarGenerador();
  };
}

function pintarCampanas() {
  $('#panelCamp').innerHTML = `
    <h3>Campañas <span class="hint">${DB.campanas.length} registradas</span></h3>
    <table><thead><tr><th>Nombre</th><th>Dcto.</th><th>Oferta</th><th>Antes</th>
      <th>Servicios</th><th>Vigencia</th><th></th></tr></thead><tbody>
      ${DB.campanas.map(c => {
        const anclaAntes = c.descuentoSobre === 'antes';
        const antesVal = anclaAntes ? c.precio_oferta : precioAntes(c.precio_oferta, c.descuento);
        const ofertaVal = anclaAntes ? Math.round(c.precio_oferta * (1 - c.descuento / 100)) : c.precio_oferta;
        return `<tr>
        <td>${c.nombre}</td><td>${c.descuento}%</td><td>${clp(c.redondear900 ? redondear900(ofertaVal) : ofertaVal)}</td>
        <td>${clp(c.redondear900 ? redondear900(antesVal) : antesVal)}${c.redondear900 ? ' <span class="hint">(aprox. ...900)</span>' : ''}</td>
        <td>${Object.values(c.servicios).reduce((a, v) => a + v.length, 0)}</td>
        <td>${c.vigencia}</td>
        <td><button class="mini" data-dup="${c.id}">Duplicar</button></td></tr>`;
      }).join('')}
    </tbody></table>
    <p class="hint">La columna <b>Antes</b> se calcula sola (oferta ÷ (1 − descuento), o el precio del tarifario cuando el descuento se aplica sobre el Antes). Nunca se digita.</p>
    <h3>Nueva campaña</h3>
    <div class="grid2">
      <label>Nombre interno <input id="ncNombre" placeholder="Pack Frenos Invierno"></label>
      <label>Título <input id="ncTitulo" placeholder="PACK FRENOS"></label>
    </div>
    <div class="grid2">
      <label>Destacado <input id="ncSub" placeholder="INVIERNO"></label>
      <label>Bajada <input id="ncBajada" placeholder="Seguridad antes de la lluvia"></label>
    </div>
    <div class="grid3">
      <label>Descuento % <input type="number" id="ncDesc" value="25"></label>
      <label>Precio oferta <input type="number" id="ncPrecio" value="99000"></label>
      <label>Vigencia <input type="date" id="ncVig"></label>
    </div>
    <button id="btnAddCamp">Crear campaña</button>
  `;
  $$('[data-dup]').forEach(b => b.onclick = () => {
    const src = DB.campanas.find(c => c.id === b.dataset.dup);
    const copia = JSON.parse(JSON.stringify(src));
    copia.id = uid(); copia.nombre = src.nombre + ' (copia)';
    DB.campanas.push(copia); pintarCampanas(); pintarGenerador();
  });
  $('#btnAddCamp').onclick = () => {
    const nombre = $('#ncNombre').value.trim(); if (!nombre) return;
    DB.campanas.push({
      id: uid(), nombre,
      titulo: $('#ncTitulo').value || nombre.toUpperCase(),
      subtitulo: $('#ncSub').value || '',
      bajada: $('#ncBajada').value || '',
      descuento: Number($('#ncDesc').value) || 0,
      precio_oferta: Number($('#ncPrecio').value) || 0,
      urgencia: 'SOLO POR ESTE MES', cta: 'AGENDA TU HORA',
      vigencia: $('#ncVig').value || '',
      servicios: { CAMBIAR: [], REALIZAR: [], INSPECCIONAR: [] },
      gratis: '', activo: true
    });
    pintarCampanas(); pintarGenerador();
  };
}

function pintarRecursos() {
  $('#panelRec').innerHTML = `
    <h3>Identidad Didial</h3>
    <div class="recursos">
      <div class="rec">
        <div class="prev dark"><img src="${ASSETS[DB.empresa.logoBlanco] || ''}"></div>
        <b>Versión blanca</b><span class="hint">fondos oscuros</span>
        <input type="file" id="upLogoBlanco" accept="image/*">
      </div>
      <div class="rec">
        <div class="prev claro"><img src="${ASSETS[DB.empresa.logoColor] || ''}"></div>
        <b>Versión a color</b><span class="hint">fondos claros</span>
        <input type="file" id="upLogoColor" accept="image/*">
      </div>
    </div>
    <p class="hint">Cada layout toma la variante que contrasta con su fondo: Toyota y Nissan
    usan la blanca, Mazda la de color. No hay que elegirla a mano.</p>
    <div class="grid2">
      <label>WhatsApp <input id="upFono" value="${esc(DB.empresa.fono)}"></label>
      <label>Dirección <input id="upDir" value="${esc(DB.empresa.direccion)}"></label>
    </div>
    <p class="hint">Los datos de contacto ya no viven dentro de una imagen: cambiarlos aquí los actualiza en toda pieza futura.</p>

    <h3>Logos de marca</h3>
    <div class="recursos">
      ${DB.marcas.map(m => `<div class="rec">
        <div class="prev dark"><img src="${ASSETS[m.logo] || ''}" alt="${m.nombre}"></div>
        <b>${m.nombre}</b>
        <input type="file" data-logo-marca="${m.id}" accept="image/*">
      </div>`).join('')}
    </div>

    <h3>Fotos de vehículos <span class="hint">una por modelo</span></h3>
    <label>Buscar modelo <input id="fBuscarRec" value="${esc(estado.filtroRec || '')}" placeholder="Hilux, CX-5…"></label>
    <div class="recursos">
      ${DB.modelos.filter(m => {
        const q = (estado.filtroRec || '').toLowerCase();
        return !q || m.nombre.toLowerCase().includes(q);
      }).slice(0, 24).map(m => `<div class="rec">
        <div class="prev dark">${m.imagen ? `<img src="${ASSETS[m.imagen] || ''}">` : '<span class="hint">sin foto</span>'}</div>
        <b>${(DB.marcas.find(x => x.id === m.marca_id) || {}).nombre} ${m.nombre}</b>
        <input type="file" data-img-veh="${m.id}" accept="image/*">
      </div>`).join('')}
    </div>
    <p class="hint">Toda imagen que subas se normaliza automáticamente: se quita el fondo blanco,
    se recorta al contorno real y se reescala. Sin ese paso, cada vehículo se vería de un tamaño distinto.</p>
  `;

  const leer = f => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(f); });

  [['#upLogoBlanco', 'logoBlanco'], ['#upLogoColor', 'logoColor']].forEach(([sel, campo]) => {
    const el = $(sel); if (!el) return;
    el.onchange = async e => {
      if (!e.target.files[0]) return;
      const key = 'logo_' + uid();
      ASSETS[key] = await normalizarImagen(await leer(e.target.files[0]),
        { maxW: 560, maxH: 240, keyWhite: false });
      DB.empresa[campo] = key; delete imgCache[key];
      if (campo === 'logoBlanco' && $('#logoCabecera')) $('#logoCabecera').src = ASSETS[key];
      pintarRecursos(); repintar();
    };
  });
  $('#upFono').oninput = e => { DB.empresa.fono = e.target.value; repintar(); };
  $('#upDir').oninput = e => { DB.empresa.direccion = e.target.value; repintar(); };
  $$('[data-logo-marca]').forEach(i => i.onchange = async e => {
    if (!e.target.files[0]) return;
    const m = DB.marcas.find(x => x.id === i.dataset.logoMarca);
    const key = 'logo_' + uid();
    ASSETS[key] = await normalizarImagen(await leer(e.target.files[0]), { maxW: 240, maxH: 180 });
    m.logo = key; pintarRecursos(); repintar();
  });
  const fbr = $('#fBuscarRec');
  if (fbr) fbr.oninput = () => {
    estado.filtroRec = fbr.value; pintarRecursos();
    const el = $('#fBuscarRec'); el.focus(); el.setSelectionRange(el.value.length, el.value.length);
  };
  $$('[data-img-veh]').forEach(i => i.onchange = async e => {
    if (!e.target.files[0]) return;
    const v = DB.modelos.find(x => x.id === i.dataset.imgVeh);
    const key = 'veh_' + uid();
    ASSETS[key] = await normalizarImagen(await leer(e.target.files[0]), { maxW: 900, maxH: 600 });
    const o = await orientacionDe(ASSETS[key]);
    v.imagen = key; v.orientacion = o.orientacion;
    if (o.orientacion === 'derecha' && !v.parche) {
      v.parche = { x: 0.77, y: 0.52, w: 0.15, h: 0.10 };
      v.parcheModo = 'restaurar';
    }
    delete imgCache[key]; pintarRecursos(); pintarGenerador(); repintar();
  });
}

function pintarHistorial() {
  $('#panelHist').innerHTML = `
    <h3>Piezas generadas <span class="hint">${DB.piezas.length}</span></h3>
    ${DB.piezas.length === 0 ? '<p class="hint">Aún no generas ninguna pieza.</p>' : `
    <table><thead><tr><th>Fecha</th><th>Vehículo</th><th>Campaña</th><th>Precio</th><th></th></tr></thead><tbody>
      ${DB.piezas.slice().reverse().map(p => `<tr>
        <td>${new Date(p.at).toLocaleString('es-CL')}</td>
        <td>${p.payload.marca} ${p.payload.etiqueta}</td>
        <td>${p.payload.titulo} ${p.payload.subtitulo}</td>
        <td>${clp(p.payload.precioOferta)}</td>
        <td><button class="mini" data-regen="${p.id}">Regenerar</button></td></tr>`).join('')}
    </tbody></table>
    <p class="hint">Cada pieza guarda una copia completa de sus datos. Regenerarla reproduce
    exactamente la original, aunque el precio de la campaña haya cambiado después.</p>`}
  `;
  $$('[data-regen]').forEach(b => b.onclick = async () => {
    const p = DB.piezas.find(x => x.id === b.dataset.regen);
    await renderPieza($('#lienzo'), p.payload);
    await exportarPNG($('#lienzo'), nombreArchivo(p.payload));
    repintar();
  });
}

function pintarDatos() {
  $('#panelDatos').innerHTML = `
    <h3>Respaldo de datos</h3>
    <p class="hint">Etapa 3 del plan reemplaza esto por Supabase. Mientras tanto, los datos viven
    en memoria: exporta el JSON antes de cerrar la pestaña.</p>
    <button id="btnExpJson">Exportar catálogo (JSON)</button>
    <label>Importar catálogo <input type="file" id="impJson" accept="application/json"></label>
    <h3>Modelo de datos actual</h3>
    <pre id="dump"></pre>
  `;
  $('#dump').textContent = JSON.stringify({
    marcas: DB.marcas.length, modelos: DB.modelos.length, vehiculos: DB.vehiculos.length,
    modelosConFoto: DB.modelos.filter(m => m.imagen).length,
    tarifas360: TARIFAS_360, tarifasGenerico: TARIFAS_GENERICO,
    ejemploModelo: DB.modelos[0], ejemploVehiculo: DB.vehiculos[0],
    campanas: DB.campanas.map(c => c.nombre), empresa: DB.empresa
  }, null, 2);
  $('#btnExpJson').onclick = () => {
    const data = { ...DB, assets: ASSETS };
    descargar(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
      'didial-catalogo.json');
  };
  $('#impJson').onchange = e => {
    const f = e.target.files[0]; if (!f) return;
    const fr = new FileReader();
    fr.onload = () => {
      try {
        const d = JSON.parse(fr.result);
        Object.assign(ASSETS, d.assets || {});
        ['marcas', 'modelos', 'vehiculos', 'campanas', 'piezas'].forEach(k => { if (d[k]) DB[k] = d[k]; });
        if (d.empresa) DB.empresa = d.empresa;
        estado.vehiculoId = vehiculoInicial();
        estado.campanaId = DB.campanas[0].id;
        estado.override = {};
        Object.keys(imgCache).forEach(k => delete imgCache[k]);
        pintarTodo(); repintar();
      } catch (err) { alert('JSON inválido: ' + err.message); }
    };
    fr.readAsText(f);
  };
}

function nombreArchivo(inp) {
  const slug = s => String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return `didial-${slug(inp.marca)}-${slug(inp.etiqueta)}-${slug(inp.titulo)}`;
}

function pintarTodo() {
  pintarGenerador(); pintarVehiculos(); pintarCampanas();
  pintarRecursos(); pintarHistorial(); pintarDatos();
}

/* ---- Arranque ---- */
async function iniciar() {
  $$('.tab').forEach(t => t.onclick = () => {
    $$('.tab').forEach(x => x.classList.remove('on'));
    $$('.panel').forEach(x => x.classList.remove('on'));
    t.classList.add('on');
    $('#' + t.dataset.panel).classList.add('on');
    if (t.dataset.panel === 'panelHist') pintarHistorial();
    if (t.dataset.panel === 'panelDatos') pintarDatos();
  });

  $('#btnPng').onclick = async () => {
    const inp = await renderAhora();
    await exportarPNG($('#lienzo'), nombreArchivo(inp));
    DB.piezas.push({ id: uid(), at: Date.now(), payload: inp });
    repintar();
  };
  $('#btnPng3').onclick = async () => {
    const inp = await renderAhora();
    await exportarPNG($('#lienzo'), nombreArchivo(inp), 3);
    repintar();
  };
  $('#btnPdf').onclick = async () => {
    const inp = await renderAhora();
    await exportarPDF($('#lienzo'), nombreArchivo(inp));
    DB.piezas.push({ id: uid(), at: Date.now(), payload: inp });
    repintar();
  };

  try {
    await document.fonts.load('900 70px Nunito');
    await document.fonts.load('500 17px Nunito');
    await document.fonts.load('400 48px Anton');
    await document.fonts.ready;
    verificarAnton();
    await document.fonts.ready;
  } catch (e) { /* sin conexión: cae a la tipografía del sistema */ }

  const lc = $('#logoCabecera');
  if (lc) lc.src = ASSETS[DB.empresa.logoBlanco] || '';
  estado.vehiculoId = vehiculoInicial();
  pintarTodo();
  repintar();
}

document.addEventListener('DOMContentLoaded', iniciar);

