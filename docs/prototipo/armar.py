blanco=open('m_blanca.txt').read().strip(); color=open('m_color.txt').read().strip()
css=open('base.css').read()+open('extra.css').read()
acceso=open('p_acceso.html').read(); shell=open('p_shell.html').read()
exped=open('pagina_expediente.html').read(); segur=open('p_seguridad.html').read()
funcs=open('p_funcionarios.html').read(); modal=open('p_modales.html').read()
js=open('app.js').read()
exped=exped.replace('  <main class="contenido">','<section class="pagina" id="pgExpediente">').replace('  </main>','</section>')
shell=shell.replace('__PAGINAS__', exped+"\n"+funcs+"\n"+segur)
cab=('<title>Prototipo SIGEL</title>\n'
 '<link rel="preconnect" href="https://fonts.googleapis.com">\n'
 '<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n'
 '<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Public+Sans:ital,wght@0,400;0,600;0,700;0,800;1,400&display=swap">\n')
doc=(cab+'\n<style>\n'+css+'\n</style>\n\n'+acceso+"\n\n"+shell+"\n\n"+modal+"\n\n<script>\n"+js+"\n</script>\n")
doc=doc.replace('__LOGO_COLOR__','data:image/png;base64,'+color)
doc=doc.replace('__LOGO_BLANCO__','data:image/png;base64,'+blanco)
doc=doc.replace('__LOGO__','data:image/png;base64,'+blanco)
open('prototipo.html','w').write(doc)
print('armado:', len(doc))
