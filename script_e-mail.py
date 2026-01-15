import smtplib

server = smtplib.SMTP("smtp.gmail.com", 587, timeout=10)
server.starttls()
server.login("findway85@gmail.com", "wwjcfeaqjagbjelw")
print("Conectou com sucesso!")
server.quit()
