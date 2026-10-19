/**
 * =============================================================================
 * PulseBox Cyber Desk — Secure TLS & Pinned Root CA Configuration
 * =============================================================================
 * 
 * SECURITY MANDATE:
 * - NO INSECURE TLS: Calling client.setInsecure() is strictly prohibited.
 * - Pinned Root Certificate Authority (CA) guarantees certificate authenticity,
 *   mitigating Man-in-the-Middle (MITM) attacks on public or shared LAN Wi-Fi.
 * - Uses ISRG Root X1 (Let's Encrypt / modern standard Root CA).
 * =============================================================================
 */

#ifndef PULSEBOX_CA_CERT_H
#define PULSEBOX_CA_CERT_H

#include <Arduino.h>

// ISRG Root X1 Root CA Certificate (PEM format)
// Valid until: Jun 4 11:04:38 2035 GMT
// SHA-256 Fingerprint: 96:BC:EC:06:26:49:76:F3:74:60:77:9A:CF:28:C5:A7:CF:E8:A3:C0:AA:E1:1A:8F:FC:EE:05:C0:BD:DF:08:C6
const char ROOT_CA_CERT[] PROGMEM = R"EOF(
-----BEGIN CERTIFICATE-----
MIIFazCCA1OgAwIBAgIRAIIQz7DSQONZRGPgu2OCiwAwDQYJKoZIhvcNAQELBQAw
TzELMAkGA1UEBhMCVVMxKTAnBgNVBAoTIEludGVybmV0IFNlY3VyaXR5IFJlc2Vh
cmNoIEdyb3VwMRUwEwYDVQQDEwxJU1JHIFJvb3QgWDEwHhcNMTUwNjA0MTEwNDM4
WhcNMzUwNjA0MTEwNDM4WjBPMQswCQYDVQQGEwJVUzEpMCcGA1UEChMgSW50ZXJu
ZXQgU2VjdXJpdHkgUmVzZWFyY2ggR3JvdXAxFTATBgNVBAMTDElTUkcgUm9vdCBY
MTCCAiIwDQYJKoZIhvcNAQEBBQADggIPADCCAgoCggIBAK3oQwgKhjZTOzzMEYBy
P3zQDUmspnUHD9MpLCTCVDZMggqi4m4dnN80833fZDZVKIncXqnLSqv5UL8dVYMxo
Xezkh0+/g/7iRfIOkOYMJkKWNXo/lfUORP7N+xK9h82IL86S29267hkcLF++nOFMQ
epWQ126msNXMylvx5D68mTu++yA3kg8CGoEdrJCM60U9Vb0JWC1O4nwEtMTJE350
Er88EHzg8GhyXZE98+Q/Jos6o+KhHKc8UfZcFpkBpYfFYdDJyAIrgELGiVDtwPXG
jZl9ZDrblucPgO2ndydsW7qE05lSEhqZc5Ogiw00/U4ksFVrQXamJqL4ZgZqhF14
odZ26US5X1WtxYo35LupCB63nVAGWB/EewmW4sjJMWZ5hnWDgmlbz+gEKmaHAEhy
fvT27U8FunJCQGCamomFoVS361PtYmELbWAVDYMfYNd4EquNewtonqGoi+SUxxzKe
EtCQ6lpdRhAOYFFcgPXAn5248bvxja2H5UhzCcrf/aOpWA6uoIf8gDZmx4t0d3/+
Ak0IiyoB6EZ0OwxVs972qwLfddUUrEGptl42CnNWhxCHG90FB099cIKSGveb42tu
/HdX30rYKoyPXgFW9dd5DYgioVl9keRXXrJq4ZytxUH574vTXAYbagAxRWOydOR1
TtZOfPOzRMWZidJY1CdS50V4/AwAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAP
BgNVHRMBAf8EBTADAQH/MB0GA1UdDgQWBBR5tFnme7bl5AFzgAjHTU7P02hN+zAN
BgkqhkiG9w0BAQsFAAOCAgEAVR9YqbyhurdtUSUxXPYTjg95dGi8JnCRtzgovIB7
WKJW99W86yD56Oc374P5WJykybUvZ/VDtfUgHYTD8tLcvPCupUqqm5a842206Bx7
8ZwnDYZA6pyvCabxfQxbjQwmgNWxMAxC615w7kJ2Zx5A15i57UKAWbOz2cYPpG+e
7KptRTSmnxEE8CA5KPLO8Q4Alg9NOorLfsXiNTJKAJKjdbYS99bOEYP4QU6Sv1gk
MESj/DLQkV2m+LhoJP293258nR8nT6496ZB4gVHJqbBCE8HzFPZtGYG1ILaN5OpZ
0g5qyqJGzW5dKMTGnuPWCx9MmTflvFVaaSvDPGSWaZEdiTt997Yh73UGYUVs5Zzz
AITvx5y+aETKBI4njUEmGpvZgZ3mWAJRnXNm9wF22U027nC4eXeFjstEI+FAQuRe
W+0ygDitIrHgMzPyro8U6g8CTZKh39jqwVaCA8Pt9r1Uy2Aqvjns5YZT6gnMzkuk
dZ7U8VDzrfvNzgCoU96WA8GKC2j9AtdvG6Q50Rg2Z8PN3wNLaZITmEUpb5tkW8b5
cDGeR3W630v5hmUMUPqxnRJhh5Ky//LXUWTYSQqKAJnFVytePCvU7bMpZoJOrevH
fZ69yDTnhUNWwbktNQec32bdCqLi0PBrcGd0s0ZVsHPUq+tIrIdbY8/sWCg=
-----END CERTIFICATE-----
)EOF";

#endif // PULSEBOX_CA_CERT_H
