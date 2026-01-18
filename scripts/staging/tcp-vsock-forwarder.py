#!/usr/bin/env python3
"""
TCP to VSOCK forwarder for Nitro Enclaves.
Forwards TCP connections from host to enclave VSOCK port.

Usage: tcp-vsock-forwarder.py <local_port> <enclave_cid> <enclave_vsock_port>
"""

import socket
import struct
import threading
import sys
import os

# VSOCK constants (from linux/vm_sockets.h)
AF_VSOCK = 40
IOCTL_VM_SOCKETS_GET_LOCAL_CID = 0x7b9

def get_local_cid():
    """Get the local VSOCK CID."""
    try:
        s = socket.socket(AF_VSOCK, socket.SOCK_STREAM)
        cid = s.getsockopt(AF_VSOCK, 0, struct.pack('I', 0))
        return struct.unpack('I', cid)[0]
    except Exception as e:
        print(f"Error getting local CID: {e}")
        return 2  # VMADDR_CID_HYPERVISOR as fallback

def forward_tcp_to_vsock(local_port, enclave_cid, enclave_vsock_port):
    """Forward TCP connections to VSOCK."""
    
    server_sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    server_sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
    
    try:
        server_sock.bind(('0.0.0.0', local_port))
        server_sock.listen(10)
        print(f"Listening on 0.0.0.0:{local_port} -> VSOCK:{enclave_cid}:{enclave_vsock_port}")
        
        while True:
            try:
                client_sock, addr = server_sock.accept()
                print(f"Connection from {addr}")
                
                # Connect to VSOCK
                vsock_sock = socket.socket(AF_VSOCK, socket.SOCK_STREAM)
                try:
                    vsock_sock.connect((enclave_cid, enclave_vsock_port))
                    print(f"Connected to VSOCK {enclave_cid}:{enclave_vsock_port}")
                    
                    # Forward in both directions
                    def forward(src, dst, direction):
                        try:
                            while True:
                                data = src.recv(4096)
                                if not data:
                                    break
                                dst.sendall(data)
                        except Exception as e:
                            print(f"Forward {direction} error: {e}")
                        finally:
                            src.close()
                            dst.close()
                    
                    t1 = threading.Thread(target=forward, args=(client_sock, vsock_sock, "TCP->VSOCK"))
                    t2 = threading.Thread(target=forward, args=(vsock_sock, client_sock, "VSOCK->TCP"))
                    t1.daemon = True
                    t2.daemon = True
                    t1.start()
                    t2.start()
                    
                except Exception as e:
                    print(f"VSOCK connect error: {e}")
                    client_sock.close()
                    
            except Exception as e:
                print(f"Accept error: {e}")
                
    except Exception as e:
        print(f"Server error: {e}")
    finally:
        server_sock.close()

if __name__ == "__main__":
    if len(sys.argv) != 4:
        print(f"Usage: {sys.argv[0]} <local_port> <enclave_cid> <enclave_vsock_port>")
        print(f"Example: {sys.argv[0]} 3000 17 3000")
        sys.exit(1)
    
    local_port = int(sys.argv[1])
    enclave_cid = int(sys.argv[2])
    enclave_vsock_port = int(sys.argv[3])
    
    print(f"TCP->VSOCK Forwarder")
    print(f"Local: 0.0.0.0:{local_port}")
    print(f"Remote: VSOCK {enclave_cid}:{enclave_vsock_port}")
    print(f"Local CID: {get_local_cid()}")
    
    forward_tcp_to_vsock(local_port, enclave_cid, enclave_vsock_port)
