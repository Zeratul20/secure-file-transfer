from qiskit import QuantumCircuit
from qiskit_aer import AerSimulator
import numpy as np
import hashlib
import base64

class BB84Simulator:
    def __init__(self, num_qubits=256):
        self.num_qubits = num_qubits
        self.simulator = AerSimulator()

    def generate_key(self):
        print(f"Generating {self.num_qubits} simulated photons...")

        alice_bits = np.random.randint(2, size=self.num_qubits)
        alice_bases = np.random.randint(2, size=self.num_qubits)

        bob_bases = np.random.randint(2, size=self.num_qubits)
        bob_results = []

        for i in range(self.num_qubits):
            qc = QuantumCircuit(1, 1)

            if alice_bits[i] == 1:
                qc.x(0)
            if alice_bases[i] == 1:
                qc.h(0)

            if bob_bases[i] == 1:
                qc.h(0)
            qc.measure(0, 0)

            result = self.simulator.run(qc, shots=1).result()
            counts = result.get_counts()
            measured_bit = int(list(counts.keys())[0])
            bob_results.append(measured_bit)

        sifted_key = []
        for i in range(self.num_qubits):
            if alice_bases[i] == bob_bases[i]:
                sifted_key.append(str(alice_bits[i]))

        raw_key_string = "".join(sifted_key)
        aes_key_bytes = hashlib.sha256(raw_key_string.encode()).digest()
        
        return base64.b64encode(aes_key_bytes).decode('utf-8')

if __name__ == "__main__":
    qkd = BB84Simulator()
    key = qkd.generate_key()
    print("Final Secure AES Key:", key)