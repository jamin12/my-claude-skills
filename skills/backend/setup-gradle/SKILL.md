---
name: setup-gradle
description: Kotlin + Spring Boot 프로젝트의 Gradle Convention Plugin 빌드 구조 가이드라인
user_invocable: true
---

# Gradle Convention Plugin 빌드 가이드라인

Kotlin + Spring Boot 멀티모듈 프로젝트의 빌드 설정 규칙.
새 프로젝트 초기 구성, 서브모듈 추가, 빌드 설정 변경 시 이 가이드라인을 따른다.

## 적용 시점

- 새 Kotlin + Spring Boot 프로젝트 초기 설정
- 서브모듈 추가
- Convention Plugin 수정 또는 추가
- 빌드 의존성 변경

---

## 규칙 목록

### CRITICAL — 구조 원칙

#### `structure-convention-plugin`
빌드 공통 설정은 반드시 `build-logic/` composite build의 Convention Plugin(precompiled script plugin)으로 관리한다.

```
build-logic/
├── build.gradle.kts
├── settings.gradle.kts
└── src/main/kotlin/
    └── {플러그인명}.gradle.kts
```

#### `structure-no-subprojects`
루트 `build.gradle.kts`에서 `subprojects {}` / `allprojects {}` 블록으로 플러그인이나 의존성을 적용하지 않는다. Gradle 공식 안티패턴이다. 유일한 예외는 `group`/`version` 같은 프로젝트 메타데이터 설정이다.

```kotlin
// WRONG
subprojects {
    apply(plugin = "kotlin")
    dependencies { ... }
}

// CORRECT — 각 서브모듈에서 convention plugin 적용
plugins { id("spring") }
```

#### `structure-plugin-chaining`
Convention Plugin은 체이닝으로 구성한다. 하위 플러그인이 상위를 포함하여 중복 설정을 방지한다.

```
common (kotlin + ktlint + 테스트)
  ↑
spring (common + spring boot + 기본 의존성)
  ↑
app (spring + bootJar 활성화 + web)

jpa (독립, spring과 조합 가능)
```

서브모듈은 체인 끝의 플러그인만 적용하면 된다:
- 실행 모듈: `plugins { id("app") }`
- 라이브러리 모듈: `plugins { id("spring") }`
- JPA 추가: `plugins { id("spring"); id("jpa") }`

---

### HIGH — 버전 관리

#### `version-catalog`
모든 라이브러리 의존성 버전은 `gradle/libs.versions.toml`(Version Catalog)에서 중앙 관리한다. 서브모듈의 `build.gradle.kts`나 Convention Plugin에 버전을 하드코딩하지 않는다.

#### `version-catalog-no-typesafe`
Convention Plugin(precompiled script plugin) 내에서 Version Catalog type-safe accessor(`libs.xxx`)는 사용할 수 없다. `findLibrary()` 패턴을 사용한다.

```kotlin
// WRONG — Convention Plugin에서 사용 불가
dependencies {
    implementation(libs.spring.boot.starter)
}

// CORRECT
val catalog = extensions.findByType<VersionCatalogsExtension>()?.named("libs")
dependencies {
    catalog?.let {
        add("implementation", it.findLibrary("spring-boot-starter").get())
    }
}
```

단, 서브모듈의 `build.gradle.kts`에서는 `libs.xxx` 사용 가능하다.

#### `version-sync`
`build-logic/build.gradle.kts`의 Versions 객체와 `gradle/libs.versions.toml`의 버전은 반드시 동기화한다. Kotlin, Spring Boot 버전이 양쪽에 존재하므로 변경 시 둘 다 수정해야 한다.

---

### MEDIUM — 플러그인 설계

#### `plugin-bootjar-default`
`spring` 플러그인은 `bootJar`를 비활성화하고 `jar`를 활성화한다 (라이브러리 모듈 기본값). `app` 플러그인만 `bootJar`를 활성화한다. 실행 가능 모듈은 프로젝트에 하나만 존재해야 한다.

#### `plugin-common-includes`
`common` 플러그인에는 모든 Kotlin 모듈에 공통으로 필요한 설정만 포함한다:
- `kotlin("jvm")` + JDK 버전
- `ktlint`
- Kotlin 공통 라이브러리 (stdlib, reflect, jackson, logging)
- 테스트 프레임워크 (kotest, mockk, junit5)

#### `plugin-single-responsibility`
Convention Plugin 하나는 하나의 관심사만 담당한다. JPA 설정을 `spring`에 합치지 말고 `jpa` 플러그인으로 분리하여 필요한 모듈만 조합한다.

#### `plugin-ktlint-lazy`
`ktlint.gradle.kts`에서 `prepareKotlinBuildScriptModel` 태스크 참조 시 `tasks.named()` 대신 `tasks.configureEach`로 지연 참조한다. 플러그인 적용 순서에 따라 태스크가 아직 없을 수 있기 때문이다.

```kotlin
// WRONG — 태스크 미존재 시 에러
tasks.named("prepareKotlinBuildScriptModel") {
    dependsOn("addKtlintFormatGitPreCommitHook")
}

// CORRECT
tasks.configureEach {
    if (name == "prepareKotlinBuildScriptModel") {
        dependsOn("addKtlintFormatGitPreCommitHook")
    }
}
```

---

### LOW — 서브모듈 추가

#### `module-structure`
서브모듈 추가 시 다음 구조를 따른다:

1. 디렉토리 생성: `{모듈명}/src/main/kotlin/com/jamin/chartbit/`, `src/main/resources/`, `src/test/kotlin/`
2. `{모듈명}/build.gradle.kts` 작성 — 필요한 convention plugin 적용
3. 루트 `settings.gradle.kts`에 `include("{모듈명}")` 추가
4. `./gradlew :{모듈명}:compileKotlin`으로 빌드 검증

#### `module-app-entry`
`app` 플러그인을 사용하는 실행 모듈에는 `@SpringBootApplication` 클래스와 `application.yaml`을 포함한다.
