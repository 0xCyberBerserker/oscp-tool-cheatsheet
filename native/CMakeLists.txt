cmake_minimum_required(VERSION 3.24)

project(oscp_knowledge_paths VERSION 0.3.0 LANGUAGES CXX)

include(GNUInstallDirs)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

find_package(Qt6 6.5 REQUIRED COMPONENTS Quick QuickControls2 LinguistTools)

qt_standard_project_setup(REQUIRES 6.5 I18N_SOURCE_LANGUAGE en I18N_TRANSLATED_LANGUAGES es ca)
qt_policy(SET QTP0004 NEW)

qt_add_executable(oscp-knowledge-paths main.cpp)

set_target_properties(oscp-knowledge-paths PROPERTIES
    WIN32_EXECUTABLE TRUE
    MACOSX_BUNDLE TRUE
)

if(ANDROID)
    set_target_properties(oscp-knowledge-paths PROPERTIES
        QT_ANDROID_PACKAGE_NAME "io.github.cyberberserker.oscpknowledgepaths"
        QT_ANDROID_APP_NAME "OSCP Knowledge Paths"
        QT_ANDROID_VERSION_NAME "${PROJECT_VERSION}"
        QT_ANDROID_VERSION_CODE 3
        QT_ANDROID_MIN_SDK_VERSION 28
        QT_ANDROID_TARGET_SDK_VERSION 36
    )
endif()

qt_add_qml_module(oscp-knowledge-paths
    URI OSCP.Knowledge
    VERSION 1.0
    QML_FILES qml/Main.qml
)

qt_add_resources(oscp-knowledge-paths knowledge_pack
    PREFIX "/"
    BASE "${CMAKE_CURRENT_SOURCE_DIR}/.."
    FILES "${CMAKE_CURRENT_SOURCE_DIR}/../knowledge/packs/oscp-interactive.json"
)

qt_add_translations(oscp-knowledge-paths
    TS_FILES
        translations/oscp_knowledge_es.ts
        translations/oscp_knowledge_ca.ts
    RESOURCE_PREFIX "/i18n"
)

target_link_libraries(oscp-knowledge-paths PRIVATE Qt6::Quick Qt6::QuickControls2)

install(TARGETS oscp-knowledge-paths
    BUNDLE DESTINATION .
    RUNTIME DESTINATION ${CMAKE_INSTALL_BINDIR}
    LIBRARY DESTINATION ${CMAKE_INSTALL_LIBDIR}
)

if(WIN32)
    qt_generate_deploy_qml_app_script(
        TARGET oscp-knowledge-paths
        OUTPUT_SCRIPT deploy_script
        NO_UNSUPPORTED_PLATFORM_ERROR
    )
    install(SCRIPT ${deploy_script})

    set(CPACK_GENERATOR "WIX")
    set(CPACK_WIX_VERSION 4)
    set(CPACK_WIX_UPGRADE_GUID "D053058F-42AF-445F-8BF7-35B8A4EC7CD6")
    set(CPACK_PACKAGE_NAME "OSCP Knowledge Paths")
    set(CPACK_PACKAGE_VENDOR "0xCyberBerserker")
    set(CPACK_PACKAGE_INSTALL_DIRECTORY "OSCP Knowledge Paths")
    set(CPACK_PACKAGE_FILE_NAME "oscp-knowledge-paths-${PROJECT_VERSION}-windows-x86_64")
    set(CPACK_PACKAGE_EXECUTABLES "oscp-knowledge-paths" "OSCP Knowledge Paths")
endif()

include(CPack)
