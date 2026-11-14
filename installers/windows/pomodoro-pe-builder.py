#!/usr/bin/env python3
"""
PE32+ (x86_64) Native Windows GUI Executable Builder
Generates minimal, fast, and silent native Windows .exe files on Linux without Wine or MinGW.
Subsystem: IMAGE_SUBSYSTEM_WINDOWS_GUI (Runs completely silent, no console window flash).
"""

import sys
import struct

def build_pe_executable(output_path, command_line):
    # 1. DOS Header (64 bytes)
    dos_header = bytearray(64)
    dos_header[0:2] = b'MZ'
    dos_header[60:64] = struct.pack('<I', 0x80)

    # 2. DOS Stub (64 bytes)
    dos_stub = b'This program cannot be run in DOS mode.\r\r\n$\0\0\0\0\0\0\0\0'.ljust(64, b'\0')

    # 3. PE Signature
    pe_sig = b'PE\0\0'

    # 4. COFF File Header (20 bytes)
    machine = 0x8664        # AMD64 (x86_64)
    num_sections = 2       # .text, .rdata
    time_date = 0x67366500
    sym_ptr = 0
    num_sym = 0
    opt_hdr_size = 240
    chars = 0x0022         # EXECUTABLE_IMAGE | LARGE_ADDRESS_AWARE
    coff_header = struct.pack('<HHIIIHH', machine, num_sections, time_date, sym_ptr, num_sym, opt_hdr_size, chars)

    # 5. Optional Header (PE32+, 240 bytes)
    magic = 0x020B         # PE32+ (64-bit)
    major_linker = 14
    minor_linker = 0
    size_of_code = 0x200
    size_of_init_data = 0x400
    size_of_uninit_data = 0
    entry_point_rva = 0x1000
    base_of_code = 0x1000
    image_base = 0x0000000140000000
    sec_align = 0x1000
    file_align = 0x200
    major_os = 6
    minor_os = 0
    major_img = 0
    minor_img = 0
    major_subsys = 6
    minor_subsys = 0
    win32_ver = 0
    size_of_image = 0x3000
    size_of_headers = 0x200
    checksum = 0
    subsystem = 2          # IMAGE_SUBSYSTEM_WINDOWS_GUI (silent, no black CMD box!)
    dll_chars = 0x8160     # DYNAMIC_BASE | NX_COMPAT | TERMINAL_SERVER_AWARE
    size_stack_reserve = 0x100000
    size_stack_commit = 0x1000
    size_heap_reserve = 0x100000
    size_heap_commit = 0x1000
    loader_flags = 0
    num_rva_sizes = 16

    opt_standard = struct.pack('<HBBIIII', magic, major_linker, minor_linker, size_of_code, size_of_init_data, size_of_uninit_data, entry_point_rva)
    opt_standard += struct.pack('<I', base_of_code)
    opt_windows = struct.pack('<QIIHHHHHHIIIIHHQQQQII',
                              image_base, sec_align, file_align,
                              major_os, minor_os, major_img, minor_img,
                              major_subsys, minor_subsys, win32_ver,
                              size_of_image, size_of_headers, checksum,
                              subsystem, dll_chars,
                              size_stack_reserve, size_stack_commit,
                              size_heap_reserve, size_heap_commit,
                              loader_flags, num_rva_sizes)

    data_dirs = bytearray(16 * 8)
    import_rva = 0x2000
    import_size = 0x200
    struct.pack_into('<II', data_dirs, 1 * 8, import_rva, import_size)

    opt_header = opt_standard + opt_windows + data_dirs
    assert len(opt_header) == 240

    # 6. Section Headers (2 * 40 = 80 bytes)
    text_hdr = struct.pack('<8sIIIIIIHHI', b'.text\0\0\0', 0x200, 0x1000, 0x200, 0x200, 0, 0, 0, 0, 0x60000020)
    rdata_hdr = struct.pack('<8sIIIIIIHHI', b'.rdata\0\0', 0x400, 0x2000, 0x400, 0x400, 0, 0, 0, 0, 0x40000040)

    header_block = dos_header + dos_stub + pe_sig + coff_header + opt_header + text_hdr + rdata_hdr
    header_block = header_block.ljust(0x200, b'\0')

    # 7. .rdata Section (Imports & Strings at RVA 0x2000)
    rdata = bytearray(0x400)
    rva_ilt = 0x2028
    rva_iat = 0x2040
    rva_dll = 0x2058
    rva_hint_winexec = 0x2070
    rva_hint_exit = 0x2080
    rva_cmd_str = 0x20A0

    import_desc = struct.pack('<IIIII', rva_ilt, 0, 0, rva_dll, rva_iat)
    null_desc = bytes(20)
    rdata[0:40] = import_desc + null_desc

    ilt = struct.pack('<QQQ', rva_hint_winexec, rva_hint_exit, 0)
    rdata[0x28:0x28+24] = ilt

    iat = struct.pack('<QQQ', rva_hint_winexec, rva_hint_exit, 0)
    rdata[0x40:0x40+24] = iat

    rdata[0x58:0x58+13] = b'KERNEL32.DLL\0'
    rdata[0x70:0x70+10] = struct.pack('<H', 0) + b'WinExec\0'
    rdata[0x80:0x80+14] = struct.pack('<H', 0) + b'ExitProcess\0'

    cmd_bytes = command_line.encode('ascii', errors='replace') + b'\0'
    rdata[0xA0:0xA0+len(cmd_bytes)] = cmd_bytes

    # 8. .text Section (Machine code at RVA 0x1000)
    text = bytearray(0x200)
    code = bytearray()

    # sub rsp, 40 (shadow space + 16-byte alignment)
    code += b'\x48\x83\xec\x28'

    # lea rcx, [rip + disp_cmd] -> command string
    next_rip = 0x1000 + len(code) + 7
    disp_cmd = rva_cmd_str - next_rip
    code += b'\x48\x8d\x0d' + struct.pack('<i', disp_cmd)

    # xor edx, edx -> uCmdShow = SW_HIDE (0)
    code += b'\x31\xd2'

    # call [rip + disp_winexec] -> WinExec
    next_rip = 0x1000 + len(code) + 6
    disp_winexec = rva_iat - next_rip
    code += b'\xff\x15' + struct.pack('<i', disp_winexec)

    # xor ecx, ecx -> uExitCode = 0
    code += b'\x31\xc9'

    # call [rip + disp_exit] -> ExitProcess
    next_rip = 0x1000 + len(code) + 6
    disp_exit = (rva_iat + 8) - next_rip
    code += b'\xff\x15' + struct.pack('<i', disp_exit)

    text[0:len(code)] = code

    with open(output_path, 'wb') as f:
        f.write(header_block)
        f.write(text)
        f.write(rdata)

if __name__ == '__main__':
    if len(sys.argv) < 3:
        print("Usage: pomodoro-pe-builder.py <output.exe> <command_line>")
        sys.exit(1)
    build_pe_executable(sys.argv[1], sys.argv[2])
    print(f"Built native Windows PE executable: {sys.argv[1]}")
