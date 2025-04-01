#!/usr/bin/env python3
import os
import sys

def processa_js_files(cartella, file_output):
    """
    Percorre ricorsivamente la cartella data e scrive in file_output
    il nome del file (preceduto da //) e il suo contenuto.
    """
    with open(file_output, "w", encoding="utf-8") as out:
        for root, dirs, files in os.walk(cartella):
            for filename in files:
                if filename.endswith(".js"):
                    percorso_file = os.path.join(root, filename)
                    out.write(f"//{filename}\n")
                    try:
                        with open(percorso_file, "r", encoding="utf-8") as f:
                            contenuto = f.read()
                            out.write(contenuto + "\n")
                    except Exception as e:
                        out.write(f"// Impossibile leggere {filename}: {e}\n")

def main():
    if len(sys.argv) != 3:
        print("Uso: {} <cartella_di_input> <file_di_output>".format(sys.argv[0]))
        sys.exit(1)

    cartella_di_input = sys.argv[1]
    file_di_output = sys.argv[2]

    if not os.path.isdir(cartella_di_input):
        print(f"Errore: {cartella_di_input} non è una cartella valida.")
        sys.exit(1)

    processa_js_files(cartella_di_input, file_di_output)
    print(f"Elaborazione completata. Output salvato in {file_di_output}")

if __name__ == '__main__':
    main()