import forge from 'node-forge'
import { mkdirSync, existsSync, readFileSync, writeFileSync } from 'node:fs'
import { networkInterfaces } from 'node:os'
import { fileURLToPath } from 'node:url'

const directory = fileURLToPath(new URL('../.certs/', import.meta.url))
mkdirSync(directory, { recursive: true })
const caPath = directory + '/ca.cer'
const caKeyPath = directory + '/ca-key.pem'
let caCertificate
let caKey

if (existsSync(caPath) && existsSync(caKeyPath)) {
  caCertificate = forge.pki.certificateFromPem(readFileSync(caPath, 'utf8'))
  caKey = forge.pki.privateKeyFromPem(readFileSync(caKeyPath, 'utf8'))
} else {
  const keys = forge.pki.rsa.generateKeyPair(2048)
  caKey = keys.privateKey
  caCertificate = forge.pki.createCertificate()
  caCertificate.publicKey = keys.publicKey
  caCertificate.serialNumber = '01' + forge.util.bytesToHex(forge.random.getBytesSync(15))
  caCertificate.validity.notBefore = new Date(Date.now() - 300000)
  caCertificate.validity.notAfter = new Date(Date.now() + 365 * 86400000)
  const subject = [{ name: 'commonName', value: 'LiveKit Learning Local CA' }]
  caCertificate.setSubject(subject)
  caCertificate.setIssuer(subject)
  caCertificate.setExtensions([
    { name: 'basicConstraints', cA: true, critical: true },
    { name: 'keyUsage', keyCertSign: true, cRLSign: true, critical: true },
  ])
  caCertificate.sign(caKey, forge.md.sha256.create())
  writeFileSync(caPath, forge.pki.certificateToPem(caCertificate))
  writeFileSync(caKeyPath, forge.pki.privateKeyToPem(caKey), { mode: 0o600 })
}

const addresses = new Set(['127.0.0.1'])
for (const interfaces of Object.values(networkInterfaces())) {
  for (const network of interfaces || []) {
    if (network.family === 'IPv4' && !network.internal && !network.address.startsWith('198.18.')) {
      addresses.add(network.address)
    }
  }
}
const keys = forge.pki.rsa.generateKeyPair(2048)
const certificate = forge.pki.createCertificate()
certificate.publicKey = keys.publicKey
certificate.serialNumber = '02' + forge.util.bytesToHex(forge.random.getBytesSync(15))
certificate.validity.notBefore = new Date(Date.now() - 300000)
certificate.validity.notAfter = new Date(Date.now() + 90 * 86400000)
certificate.setSubject([{ name: 'commonName', value: 'LiveKit Learning' }])
certificate.setIssuer(caCertificate.subject.attributes)
certificate.setExtensions([
  { name: 'basicConstraints', cA: false, critical: true },
  { name: 'keyUsage', digitalSignature: true, keyEncipherment: true, critical: true },
  { name: 'extKeyUsage', serverAuth: true },
  {
    name: 'subjectAltName',
    altNames: [
      { type: 2, value: 'localhost' },
      ...Array.from(addresses, ip => ({ type: 7, ip })),
    ],
  },
])
certificate.sign(caKey, forge.md.sha256.create())
writeFileSync(directory + '/server.pem', forge.pki.certificateToPem(certificate))
writeFileSync(directory + '/server-key.pem', forge.pki.privateKeyToPem(keys.privateKey), { mode: 0o600 })
console.log('Development certificate generated. Install .certs/ca.cer on your test phone.')
for (const ip of addresses) {
  console.log('HTTPS: https://' + ip + ':5174')
}
